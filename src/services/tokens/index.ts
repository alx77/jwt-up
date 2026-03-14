import jwtHelper from "../../utils/JwtHelper.js";
import type { JwkResponse } from "../../types/index.js";

class TokenService {
  async getJwk(): Promise<JwkResponse> {
    return jwtHelper.getJwk();
  }
}

export default new TokenService();
