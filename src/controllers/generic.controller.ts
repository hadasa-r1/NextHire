import type { Request, RequestHandler, Response } from "express";
import mongoose = require("mongoose");
import Repository = require("../repository/repository");

type ControllerHandler = RequestHandler<Request["params"], unknown, unknown>;

class GenericController<T extends object> {
  constructor(
    private readonly repository: Pick<Repository<T>, keyof Repository<T>>
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

  readonly getAll: ControllerHandler = async (_req, res) => {
    const documents = await this.repository.getAll();
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
    return typeof body === "object" && body !== null && !Array.isArray(body);
  }
}

export = GenericController;
