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
    id: string,
    data: Partial<T>
  ): Promise<mongoose.HydratedDocument<T> | null> {
    return this.model
      .findByIdAndUpdate(
        id,
        { $set: data },
        { returnDocument: "after", runValidators: true }
      )
      .exec();
  }

  async remove(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id).exec();
  }
}

export = Repository;
