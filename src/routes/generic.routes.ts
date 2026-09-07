import express = require("express");
import GenericController = require("../controllers/generic.controller");

function createGenericRoutes<T extends object>(
  controller: GenericController<T>
): express.Router {
  const router = express.Router();

  router.route("/")
    .post(controller.add)
    .get(controller.getAll);

  router.route("/:id")
    .get(controller.getById)
    .patch(controller.update)
    .delete(controller.remove);

  return router;
}

export = createGenericRoutes;
