import mongoose = require("mongoose");

class Repository<T> {
  constructor(private readonly model: mongoose.Model<T>) {}

  async add(data: Partial<T>): Promise<mongoose.HydratedDocument<T>> {
    return this.model.create(data);
  }

  async getAll(
    filter: mongoose.QueryFilter<T> = {},
    populate: mongoose.PopulateOptions[] = []
  ): Promise<mongoose.HydratedDocument<T>[]> {
    return this.model.find(filter).populate(populate).exec();
  }

  async getById(id: string): Promise<mongoose.HydratedDocument<T> | null> {
    return this.model.findById(id).exec();
  }

  async update(
    id: string | mongoose.QueryFilter<T>,
    data: Partial<T>,
    options: { upsert?: boolean; unset?: readonly (keyof T & string)[] } = {}
  ): Promise<mongoose.HydratedDocument<T> | null> {
    return this.model
      .findOneAndUpdate(
        (typeof id === "string" ? { _id: id } : id) as mongoose.QueryFilter<T>,
        { $set: data, ...(options.unset?.length ? { $unset: Object.fromEntries(options.unset.map(key => [key, 1])) } : {}) } as mongoose.UpdateQuery<T>,
        { returnDocument: "after", runValidators: true, upsert: options.upsert ?? false, setDefaultsOnInsert: false }
      )
      .exec();
  }

  async remove(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id).exec();
  }
}

export = Repository;
