const Joi = require("joi");
const chai = require("chai");
const axios = require("axios");
const validator = require("./validator");
const rewire = require("rewire");
const service = rewire("../../../src/services/users");
const si = require("../../StorageInitializer");
const redis = require("../../../src/utils/RedisHelper");
//const { consumer } = require("../../src/utils/KafkaHelper");
const cfg = require("../../../src/common/config");
const expect = chai.expect;
const request = require("supertest");
var { app, server } = require("../../../../index");

const ACTIVATION_CODE_PREFIX = "act_";

describe(`@users tests`, function () {
  this.timeout(10000);

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

  it("@users.2 - Creating user (service)", (done) => {
    const user = {
      name: "John",
      email: "a@a.com",
      password: "Secret123!",
      ip: "127.0.0.1",
      payload: {
        familyName: "Doe",
      },
    };

    request(app)
      .post("/api/user")
      .send(user)
      .expect("Content-Type", /json/)
      .expect(200, '{"status":"OK"}')
      .end(function (err, res) {
        //console.log("OUTPUT:" + JSON.stringify(res));
        const { error } = Joi.validate(res, validator.create);
        expect(error).to.be.a("null");

        if (err) throw err;
      });

    //consuming kafka
    // var messageValue;
    // consumer.connect().then(() => {
    //   consumer
    //     .subscribe({
    //       topic: cfg.get("KAFKA_ACTIVATION_TOPIC"),
    //       fromBeginning: true,
    //     })
    //     .then(() => {
    //       consumer.run({
    //         // eachBatch: async ({ batch }) => {
    //         //   console.log(batch)
    //         // },
    //         eachMessage: async ({ topic, partition, message }) => {
    //            const prefix = `${topic}[${partition} | ${message.offset}] / ${message.timestamp}`;
    //            console.log(`- ${prefix} ${message.key}#${message.value}`);
    //           messageValue = JSON.parse(message.value);
    //           consumer.disconnect();
    //         },
    //       });
    //     });
    // });

    setTimeout(() => {
      const activationCode =
        ACTIVATION_CODE_PREFIX + messageValue.payload.activationCode;
      // console.log("activationCode:" + activationCode);
      redis.get(activationCode).then((userStr) => {
        //check results
        const userWOPassword = JSON.parse(JSON.stringify(user));
        delete userWOPassword.password;
        const u = JSON.parse(userStr);
        delete u.password;
        expect(u).to.deep.include(userWOPassword);
        userWOPassword.payload.activationCode =
          messageValue.payload.activationCode;
        expect(messageValue).to.deep.include(userWOPassword);
        done();
      });
    }, 2000);
  });

  after(async () => {
    await si.destroy();
    server.close();
  });
});
