import type { Request, RequestHandler, Response } from "express";
import mongoose = require("mongoose");
import Repository = require("../repository/repository");

type ControllerHandler = RequestHandler<Request["params"], unknown, unknown>;

interface GenericControllerOptions<T> {
  // Query params accepted as exact-match filters on GET /. Values are read as
  // strings only; arrays and nested objects are ignored, so query operators
  // such as $ne cannot be injected through the query string.
  readonly filterableFields?: readonly (keyof T & string)[];
  // Reference fields a caller may expand with ?populate=field,field. Only list
  // fields whose target model is registered in this service.
  readonly populatableFields?: readonly (keyof T & string)[];
}

class GenericController<T extends object> {
  constructor(
    private readonly repository: Pick<Repository<T>, keyof Repository<T>>,
    private readonly options: GenericControllerOptions<T> = {}
  ) {}

  // Arrow functions keep this.repository available when passed to Express routes.
  // Express 5 forwards rejected handler promises to its error middleware.
  readonly add: ControllerHandler = async (req, res) => {
    // Express can parse a zero-byte JSON payload as {}; it is still a missing body.
    if (req.get("content-length") === "0" || !this.isObjectBody(req.body)) {
      res.status(400).json({ message: "יש לשלוח גוף בקשה כאובייקט JSON." });
      return;
    }

    const document = await this.repository.add(req.body);
    res.status(201).json(document);
  };

  readonly getAll: ControllerHandler = async (req, res) => {
    const documents = await this.repository.getAll(
      this.buildFilter(req.query),
      this.buildPopulate(req.query)
    );
    res.status(200).json(documents);
  };

  readonly getById: ControllerHandler = async (req, res) => {
    const id = this.readId(req, res);
    if (id === undefined) return;

    const document = await this.repository.getById(id);

    if (document === null) {
      res.status(404).json({ message: "הרשומה לא נמצאה." });
      return;
    }

    res.status(200).json(document);
  };

  readonly update: ControllerHandler = async (req, res) => {
    const id = this.readId(req, res);
    if (id === undefined) return;

    if (req.get("content-length") === "0" || !this.isObjectBody(req.body)) {
      res.status(400).json({ message: "יש לשלוח גוף בקשה כאובייקט JSON." });
      return;
    }

    const document = await this.repository.update(id, req.body);

    if (document === null) {
      res.status(404).json({ message: "הרשומה לא נמצאה." });
      return;
    }

    res.status(200).json(document);
  };

  readonly remove: ControllerHandler = async (req, res) => {
    const id = this.readId(req, res);
    if (id === undefined) return;

    // Repository.remove returns void, including when the record is already absent.
    await this.repository.remove(id);
    res.status(204).end();
  };

  private buildFilter(query: Request["query"]): mongoose.QueryFilter<T> {
    const filter: Partial<Record<keyof T & string, string>> = {};

    for (const field of this.options.filterableFields ?? []) {
      const value = query[field];
      if (typeof value === "string" && value !== "") {
        filter[field] = value;
      }
    }

    // Mongoose casts the string values to each field's type (ObjectId, Boolean,
    // …) and surfaces a CastError as a 400 through the error handler.
    return filter as mongoose.QueryFilter<T>;
  }

  private buildPopulate(query: Request["query"]): mongoose.PopulateOptions[] {
    const requested = query.populate;
    const names = typeof requested === "string" ? requested.split(",") : [];
    const allowed = new Set<string>(this.options.populatableFields ?? []);

    return names
      .map((name) => name.trim())
      .filter((name) => allowed.has(name))
      .map((path) => ({ path }));
  }

  private readId(req: Request, res: Response): string | undefined {
    const id = req.params.id;

    if (typeof id !== "string" || !mongoose.isObjectIdOrHexString(id)) {
      res.status(400).json({ message: "מזהה הרשומה אינו תקין." });
      return undefined;
    }

    return id;
  }

  private isObjectBody(body: unknown): body is Partial<T> {
    // Individual field types and required fields are validated by the Mongoose model.
    return typeof body === "object" && body !== null && !Array.isArray(body) &&
      // API updates accept complete top-level fields, never Mongo operators or
      // dotted paths that could bypass a Mixed field's validator.
      Object.keys(body).every(key => !key.startsWith("$") && !key.includes("."));
  }
}

export = GenericController;
