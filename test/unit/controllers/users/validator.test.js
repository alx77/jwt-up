import { describe, it, expect } from "vitest";
import validator from "@/controllers/users/validator.js";

describe("@users validators", () => {
  describe("@users - register user", () => {
    const validRegistrationData = {
      body: {
        name: "John Doe",
        login: "johndoe123",
        email: "john.doe@example.com",
        password: "SecurePass123!",
        captcha_token: "recaptcha_token_123",
        ip: "192.168.1.1"
      }
    };

    describe("with valid data", () => {
      it("should validate complete registration data", () => {
        const { error } = validator.register.validate(validRegistrationData);
        expect(error).toBeUndefined();
      });

      it("should validate registration without optional fields", () => {
        const minimalData = {
          body: {
            login: "johndoe",
            email: "john@example.com",
            password: "SecurePass123!"
          }
        };
        
        const { error } = validator.register.validate(minimalData);
        expect(error).toBeUndefined();
      });

      it("should validate registration without captcha_token", () => {
        const data = {
          body: {
            name: "John Doe",
            login: "johndoe",
            email: "john@example.com",
            password: "SecurePass123!",
            ip: "10.0.0.1"
          }
        };
        
        const { error } = validator.register.validate(data);
        expect(error).toBeUndefined();
      });

      it("should validate IPv6 address", () => {
        const data = {
          body: {
            ...validRegistrationData.body,
            ip: "2001:0db8:85a3:0000:0000:8a2e:0370:7334"
          }
        };
        
        const { error } = validator.register.validate(data);
        expect(error).toBeUndefined();
      });
    });

    describe("with invalid data", () => {
      it("should reject missing password", () => {
        const invalidData = {
          body: {
            ...validRegistrationData.body
          }
        };
        delete invalidData.body.password;
        
        const { error } = validator.register.validate(invalidData);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain("password");
      });

      it("should reject weak password without uppercase", () => {
        const data = {
          body: {
            ...validRegistrationData.body,
            password: "weakpass123!"
          }
        };
        
        const { error } = validator.register.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toEqual(["body", "password"]);
      });

      it("should reject password without special character", () => {
        const data = {
          body: {
            ...validRegistrationData.body,
            password: "Weakpass123"
          }
        };
        
        const { error } = validator.register.validate(data);
        expect(error).toBeDefined();
      });

      it("should reject short password", () => {
        const data = {
          body: {
            ...validRegistrationData.body,
            password: "A1b!"
          }
        };
        
        const { error } = validator.register.validate(data);
        expect(error).toBeDefined();
      });

      it("should reject invalid email format", () => {
        const data = {
          body: {
            ...validRegistrationData.body,
            email: "not-an-email"
          }
        };
        
        const { error } = validator.register.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].path).toEqual(["body", "email"]);
      });

      it("should reject login with special characters", () => {
        const data = {
          body: {
            ...validRegistrationData.body,
            login: "john-doe!"
          }
        };
        
        const { error } = validator.register.validate(data);
        expect(error).toBeDefined();
      });

      it("should reject name with special characters", () => {
        const data = {
          body: {
            ...validRegistrationData.body,
            name: "John@Doe"
          }
        };
        
        const { error } = validator.register.validate(data);
        expect(error).toBeDefined();
      });

      it("should reject name longer than 30 characters", () => {
        const data = {
          body: {
            ...validRegistrationData.body,
            name: "A".repeat(31)
          }
        };
        
        const { error } = validator.register.validate(data);
        expect(error).toBeDefined();
      });

      it("should reject IP with CIDR notation", () => {
        const data = {
          body: {
            ...validRegistrationData.body,
            ip: "192.168.1.1/24"
          }
        };
        
        const { error } = validator.register.validate(data);
        expect(error).toBeDefined();
      });

      it("should reject invalid IP version", () => {
        const data = {
          body: {
            ...validRegistrationData.body,
            ip: "invalid-ip"
          }
        };
        
        const { error } = validator.register.validate(data);
        expect(error).toBeDefined();
      });

      it("should reject extra fields in body", () => {
        const data = {
          body: {
            ...validRegistrationData.body,
            extraField: "should be rejected",
            anotherField: 123
          }
        };
        
        const { error } = validator.register.validate(data);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain("extraField");
      });
    });

    describe("unknown() method behavior", () => {
      it("should allow extra fields at root level but not in body", () => {
        const data = {
          body: validRegistrationData.body,
          headers: { "User-Agent": "Test" },
          query: { ref: "test" },
          extraRootField: "should be allowed"
        };
        
        const { error } = validator.register.validate(data);
        expect(error).toBeUndefined();
      });

      it("should strip unknown fields from body when stripUnknown is true", () => {
        const data = {
          body: {
            ...validRegistrationData.body,
            extraField: "should be stripped",
            unknownField: 123
          }
        };
        
        const { error, value } = validator.register.validate(data, { stripUnknown: true });
        expect(error).toBeUndefined();
        expect(value.body.extraField).toBeUndefined();
        expect(value.body.unknownField).toBeUndefined();
        expect(value.body.login).toBe("johndoe123");
      });

      it("should allow unknown fields when abortEarly is false", () => {
        const data = {
          body: {
            ...validRegistrationData.body,
            extraField: "test",
            anotherExtra: 123
          }
        };
        
        const { error } = validator.register.validate(data, { abortEarly: false });
        expect(error).toBeDefined();
        const extraFieldErrors = error.details.filter(d => 
          d.message.includes("extraField") || d.message.includes("anotherExtra")
        );
        expect(extraFieldErrors.length).toBeGreaterThan(0);
      });
    });
  });

  describe("@users - login user", () => {
    const validLoginData = {
      body: {
        email: "user@example.com",
        password: "Password123!"
      }
    };

    it("should validate correct login credentials", () => {
      const { error } = validator.login.validate(validLoginData);
      expect(error).toBeUndefined();
    });

    it("should reject login without email", () => {
      const invalidData = { body: { password: "Password123!" } };
      const { error } = validator.login.validate(invalidData);
      expect(error).toBeDefined();
    });

    it("should reject login without password", () => {
      const invalidData = { body: { email: "user@example.com" } };
      const { error } = validator.login.validate(invalidData);
      expect(error).toBeDefined();
    });

    it("should reject extra fields in login body", () => {
      const data = {
        body: {
          ...validLoginData.body,
          rememberMe: true,
          deviceId: "abc123"
        }
      };
      
      const { error } = validator.login.validate(data);
      expect(error).toBeDefined();
    });
  });

  describe("@users - read user data", () => {
    it("should validate request with user_id parameter", () => {
      const data = { params: { user_id: "user-123" } };
      const { error } = validator.read.validate(data);
      expect(error).toBeUndefined();
    });

    it("should validate request without parameters", () => {
      const data = { params: {} };
      const { error } = validator.read.validate(data);
      expect(error).toBeUndefined();
    });

    it("should reject user_id longer than 200 characters", () => {
      const data = { params: { user_id: "a".repeat(201) } };
      const { error } = validator.read.validate(data);
      expect(error).toBeDefined();
    });

    it("should allow extra fields at root level", () => {
      const data = {
        params: { user_id: "user-123" },
        query: { details: "full" },
        headers: {},
        extra: "field"
      };
      
      const { error } = validator.read.validate(data);
      expect(error).toBeUndefined();
    });
  });

  describe("@users - update user", () => {
    const validUpdateData = {
      body: {
        user_id: "user-123",
        name: "Updated Name",
        login: "newlogin",
        email: "updated@example.com"
      }
    };

    it("should validate complete update data", () => {
      const { error } = validator.update.validate(validUpdateData);
      expect(error).toBeUndefined();
    });

    it("should validate partial update data", () => {
      const data = {
        body: {
          login: "newlogin",
          email: "updated@example.com",
          user_id: "user-123",
          name: "Only Name Updated"
        }
      };
      
      const { error } = validator.update.validate(data);
      expect(error).toBeUndefined();
    });

    it("should reject update without user_id", () => {
      const invalidData = {
        body: {
          name: "Updated Name"
        }
      };
      
      const { error } = validator.update.validate(invalidData);
      expect(error).toBeDefined();
    });

    it("should reject update with invalid email", () => {
      const data = {
        body: {
          ...validUpdateData.body,
          email: "invalid-email"
        }
      };
      
      const { error } = validator.update.validate(data);
      expect(error).toBeDefined();
    });

    it("should reject extra fields in update body", () => {
      const data = {
        body: {
          ...validUpdateData.body,
          avatar: "base64image",
          settings: { theme: "dark" }
        }
      };
      
      const { error } = validator.update.validate(data);
      expect(error).toBeDefined();
    });
  });

  describe("@users - delete user", () => {
    it("should validate delete request with user_id", () => {
      const data = { params: { user_id: "user-123" } };
      const { error } = validator.del.validate(data);
      expect(error).toBeUndefined();
    });

    it("should reject delete request without user_id", () => {
      const data = { params: {} };
      const { error } = validator.del.validate(data);
      expect(error).toBeDefined();
    });

    it("should reject empty user_id", () => {
      const data = { params: { user_id: "" } };
      const { error } = validator.del.validate(data);
      expect(error).toBeDefined();
    });
  });

  describe("@users - activate user", () => {
    it("should validate activation with code", () => {
      const data = { params: { code: "activation-code-123" } };
      const { error } = validator.activate.validate(data);
      expect(error).toBeUndefined();
    });

    it("should reject activation without code", () => {
      const data = { params: {} };
      const { error } = validator.activate.validate(data);
      expect(error).toBeDefined();
    });

    it("should reject empty activation code", () => {
      const data = { params: { code: "" } };
      const { error } = validator.activate.validate(data);
      expect(error).toBeDefined();
    });
  });

  describe("@users - edge cases", () => {
    it("should handle whitespace trimming", () => {
      const data = {
        body: {
          login: "  testuser  ",
          email: "  test@example.com  ",
          password: "SecurePass123!"
        }
      };
      
      const { error, value } = validator.register.validate(data);
      expect(error).toBeUndefined();
    });

    it("should handle different email case sensitivity", () => {
      const data = {
        body: {
          login: "testuser",
          email: "TEST@EXAMPLE.COM",
          password: "SecurePass123!"
        }
      };
      
      const { error, value } = validator.register.validate(data);
      expect(error).toBeUndefined();
      expect(value.body.email).toBe("TEST@EXAMPLE.COM");
    });

    it("should handle null and undefined values", () => {
      const data = {
        body: {
          login: null,
          email: undefined,
          password: "SecurePass123!"
        }
      };
      
      const { error } = validator.register.validate(data);
      expect(error).toBeDefined();
    });

    it("should handle empty strings for optional fields", () => {
      const data = {
        body: {
          login: "testuser",
          email: "test@example.com",
          password: "SecurePass123!",
          name: ""
        }
      };
      
      const { error } = validator.register.validate(data);
    });
  });

  describe("@users - password regex validation", () => {
    const testPassword = (password, shouldPass) => {
      const data = {
        body: {
          login: "testuser",
          email: "test@example.com",
          password
        }
      };
      
      const { error } = validator.register.validate(data);
      if (shouldPass) {
        expect(error).toBeUndefined();
      } else {
        expect(error).toBeDefined();
      }
    };

    it("should accept password with all requirements", () => {
      testPassword("SecurePass123!", true);
    });

    it("should reject password without uppercase", () => {
      testPassword("lowercase123!", false);
    });

    it("should reject password without lowercase", () => {
      testPassword("UPPERCASE123!", false);
    });

    it("should reject password without digit", () => {
      testPassword("NoDigits!", false);
    });

    it("should reject password without special character", () => {
      testPassword("NoSpecial123", false);
    });

    it("should accept password with different special characters", () => {
      testPassword("Pass123@", true);
      testPassword("Pass123#", true);
      testPassword("Pass123$", true);
      testPassword("Pass123%", true);
      testPassword("Pass123^", true);
      testPassword("Pass123&", true);
      testPassword("Pass123*", true);
      testPassword("Pass123_", true);
      testPassword("Pass123:", true);
      testPassword("Pass123;", true);
      testPassword("Pass123<", true);
      testPassword("Pass123>", true);
    });
  });
});