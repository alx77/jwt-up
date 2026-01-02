import jwtHelper from "../../utils/JwtHelper.js";

class TokenService {
  async getJwk() {
    return await jwtHelper.getJwk();
  }
}

const tokenService = new TokenService();
export default tokenService;