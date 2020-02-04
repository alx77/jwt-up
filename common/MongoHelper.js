const { MongoClient } = require('mongodb');
const cfg = require("./config");

class MongoHelper {
    constructor(url, dbName) {
        this.url = url;
        this.dbName = dbName;
        this.db;
    }

    async getConnection(options = {}) {
        if (this.db) {
            return this;
        }
        const client = await MongoClient.connect(this.url, Object.assign({
            poolSize: cfg.get("MONGO_POOL_SIZE"),
            serverSelectionTimeoutMS: 5000,
            useUnifiedTopology: true
        }, options));
        this.db = client.db(this.dbName);
        return this;
    }

    async insertOne(collectionName, data) {
        const collection = this.db.collection(collectionName);
        return await collection.insertOne(data);
    }

    async insertMany(collectionName, data) {
        const collection = this.db.collection(collectionName);
        return await collection.insertMany(data);
    }

    async findOne(collectionName, filter = {}) {
        const collection = this.db.collection(collectionName);
        return await collection.findOne(filter);
    }

    async find(collectionName, filter = {}, page, size) {
        const collection = this.db.collection(collectionName);
        const result = collection.find(filter);
        page && result.skip(page * size);
        size && result.limit(size);
        return await collection.find(filter).toArray();
    }

    async updateOne(collectionName, filter, data) {
        const collection = this.db.collection(collectionName);
        return await collection.updateOne(filter, { $set: data });
    }

    async deleteOne(collectionName, filter) {
        const collection = this.db.collection(collectionName);
        return await collection.deleteOne(filter);
    }

    async createIndex(collectionName, index, options = null) {
        const collection = this.db.collection(collectionName);
        return await collection.createIndex(index, options);
    }

    async listCollections(collectionName, filter = {}, options = null) {
        const collection = this.db.collection(collectionName);
        return await collection.listCollections(index, options).toArray();
    }
}

module.exports = new MongoHelper(cfg.get("MONGO_URL"), cfg.get("MONGO_DB_NAME"));
