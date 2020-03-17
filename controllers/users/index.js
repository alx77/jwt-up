const log = require("../../common/logger");
//const metrics = require("../../common/metrics");
const userService = require("../../services/users");

async function create(req, res, next) {
  try {
    await userService.createUser(req.body)
//    metrics.increment("users.created");
    res.json({ status: "OK" }).end();
  }
  catch (e) {
    next(e);
  }
}

async function activate(req, res, next) {
  const {
    uid
  } = req.preprocessed.params;
  try {
//    const result = await userService.createUser({ ...req.body, ...req.preprocessed.body })
    const mongo = await MongoHelper.getConnection();
    const result = await mongo.findOne(USERS_COLLECTION, { uid });
    if (!result) throw new Error("Could not find entry");
    log.info(`user: ${result.email} found`);
    result.uid = encodeId(result.uid);
    res.json({ status: "OK", result }).end();
  }
  catch (e) {
    next(e);
  }
}

async function read(req, res, next) {
  const {
    uid
  } = req.preprocessed.params;
  try {
    const mongo = await MongoHelper.getConnection();
    const result = await mongo.findOne(USERS_COLLECTION, { uid });
    if (!result) throw new Error("Could not find entry");
    log.info(`user: ${result.email} found`);
    result.uid = encodeId(result.uid);
    res.json({ status: "OK", result }).end();
  }
  catch (e) {
    next(e);
  }
}

async function readByEmail(req, res, next) {
  const {
    email
  } = req.params;

  try {
    const mongo = await MongoHelper.getConnection();
    const result = await mongo.findOne(USERS_COLLECTION, { email });
    log.info(`user: ${result.email} found by email`);
    res.json(Object.assign({ status: "OK" }, result)).end();
  } catch (e) {
    next(e);
  }
}

async function update(req, res, next) {
  let {
    uid
  } = req.preprocessed.body;

  try {
    const mongo = await MongoHelper.getConnection();
    const result = await mongo.updateOne(USERS_COLLECTION, { uid }, req.preprocessed.body);
    log.info(`user: ${uid} updated`);
    res.json(Object.assign({ status: "OK" }, result)).end();
  } catch (e) {
    next(e);
  }
}

async function del(req, res, next) {
  const {
    uid
  } = req.preprocessed.params;

  try {
    const mongo = await MongoHelper.getConnection();
    const result = await mongo.deleteOne(USERS_COLLECTION, { uid });
    log.info(`user: ${uid} deleted`);
    res.json({ status: "OK", result: result.result }).end();
  } catch (e) {
    next(e);
  }
}

async function list(req, res, next) {
  const {
    page,
    size = 10
  } = req.query;

  try {
    const mongo = await MongoHelper.getConnection();
    const result = await mongo.find(USERS_COLLECTION, {}, page, size);
    log.info(`user list retrieved: ${result.n} found`);
    res.json({ status: "OK", result }).end();
  } catch (e) {
    next(e);
  }
}

module.exports = {
  create, activate, read, readByEmail, update, del, list
}
