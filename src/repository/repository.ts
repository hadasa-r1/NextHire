import mongoose = require("mongoose");

class Repository<T> {
  constructor(private readonly model: mongoose.Model<T>) {}

  async add(data: Partial<T>): Promise<mongoose.HydratedDocument<T>> {
    return this.model.create(data);
  }

  async getAll(): Promise<mongoose.HydratedDocument<T>[]> {
    return this.model.find().exec();
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
