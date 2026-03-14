import type { DecodedToken } from "./index.js";

declare global {
  namespace Express {
    interface Request {
      preprocessed?: {
        headers: {
          authorization: DecodedToken;
        };
      };
    }
  }
}

export {};
