const Joi = require("joi");
const chai = require("chai");
const validator = require("./validator");
const rewire = require("rewire");
const service = rewire("../../src/services/users");
const bcrypt = require("bcrypt");
const expect = chai.expect;

service.__set__({
  producer: {
    connect: async () => {},
    disconnect: async () => {},
    send: async () => {},
  },
});

describe(`@users tests`, function () {
  it("@users.1 - Creating user (service)", async () => {
    const revert = service.__set__({
      pg: {
        query: async function (q, params = [], resultProcessor) {
          const res = { rows: [] };
          return resultProcessor ? resultProcessor(res) : res;
        },
      },
      redis: {
        setex: async function (code, delay, userStr) {
          const user = JSON.parse(userStr);
          expect(code).to.be.a("string").with.length(14);
          expect(bcrypt.compareSync("secret", user.password)).to.be.true;
        },
      },
    });

    const response = await service.createUser({
      name: "John",
      email: "a@a.com",
      password: "secret",
      ip: "127.0.0.1",
      payload: {
        familyName: "Doe",
      },
    });
    const { error } = Joi.validate(response, validator.create);
    expect(error).to.be.a("null");
    revert();
  });
});

// describe(`@users tests`, function() {
//   it("@users.2 - Creating user (service)", async () => {
//     const response = await service.createUser({
//       name: "John",
//       email: "a@a.com",
//       password: "secret",
//       ip: "127.0.0.1",
//       payload: {
//         familyName: "Doe"
//       }
//     });
//     const { error } = Joi.validate(response, validator.create);
//     expect(error).to.be.a("null");
//   });
// });
