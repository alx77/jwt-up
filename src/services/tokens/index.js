const jwtHelper = require("../../utils/JwtHelper");

class TokenService {

  async getJwk() {
    return await jwtHelper.getJwk();
  }
}

module.exports = new TokenService();
