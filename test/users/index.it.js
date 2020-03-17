const Joi = require("joi");
const chai = require("chai");
const axios = require("axios");
const validator = require("./validator");
const rewire = require("rewire");
const service = rewire("../../services/users");
const si = require("../StorageInitializer");
const redis = require("../../utils/RedisHelper");
const { consumer } = require("../../utils/KafkaHelper");
const cfg = require("../../common/config");
const expect = chai.expect;
const request = require("supertest");
var { app, server } = require("../../index");

// var activationCode;

// service.__set__({
//   producer: {
//     connect: async function() {},
//     send: async function(data) {
//       activationCode = data.messages[0].value.payload.activationCode;
//     }
//   }
// });

describe(`@users tests`, function() {
  this.timeout(5000);

  before(async () => {
    try {
      await si.init();
      await si.cleanRedisKeysByPattern();
    } catch (e) {
      console.log(e);
      throw e;
    }
  });

  // it("@users.1 - Creating user (service)", async () => {
  //   const user = {
  //     name: "John",
  //     email: "a@a.com",
  //     password: "secret",
  //     ip: "127.0.0.1",
  //     payload: {
  //       familyName: "Doe"
  //     }
  //   };
  //   const response = await service.createUser(user);
  //   const { error } = Joi.validate(response, validator.create);
  //   expect(error).to.be.a("null");
  //   const userStr = await redis.get(activationCode);
  //   expect(user).to.deep.equal(JSON.parse(userStr));
  // });

  it("@users.2 - Creating user (service)", async () => {
    const user = {
      name: "John",
      email: "a@a.com",
      password: "Secret123!",
      ip: "127.0.0.1",
      payload: {
        familyName: "Doe"
      }
    };

    request(app)
      .post("/api/user")
      .send(user)
      .expect("Content-Type", /json/)
      //.expect("Content-Length", "3347З")
      .expect(200, '{"status":"OK"}')
      .end(function(err, res) {
        console.log("OUTPUT:" + JSON.stringify(res));
        const { error } = Joi.validate(res, validator.create);
        expect(error).to.be.a("null");

        if (err) throw err;
      });

      await consumer.connect()
      setTimeout(async ()=>{await consumer.disconnect()}, 3000)
  await consumer.subscribe({ topic: cfg.get("KAFKA_ACTIVATION_TOPIC"), fromBeginning: true })
  await consumer.run({
    // eachBatch: async ({ batch }) => {
    //   console.log(batch)
    // },
    eachMessage: async ({ topic, partition, message }) => {
      const prefix = `${topic}[${partition} | ${message.offset}] / ${message.timestamp}`
      console.log(`- ${prefix} ${message.key}#${message.value}`)
    },
  })
  });

  after(async () => {
    await si.destroy();
    server.close();
  });
});
