import { vi } from 'vitest';

class MockTransporter {
  constructor() {
    this.sentMail = [];
    
    this.sendMail = vi.fn(async (mailOptions) => {
      const mailRecord = {
        ...mailOptions,
        timestamp: new Date(),
        id: Date.now().toString(36) + Math.random().toString(36).substr(2)
      };
      
      this.sentMail.push(mailRecord);
      
      return {
        messageId: `<${mailRecord.id}@mock.local>`,
        envelope: {
          from: mailOptions.from,
          to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to]
        },
        accepted: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
        rejected: [],
        pending: [],
        response: '250 2.0.0 OK Mock message accepted'
      };
    });
    
    this.verify = vi.fn(async () => {
      return true;
    });
    
    this.close = vi.fn(() => {
      return Promise.resolve();
    });
    
    this.clearSentMail = () => {
      this.sentMail = [];
    };
    
    this.getSentMail = () => [...this.sentMail];
    
    this.getLastSentMail = () => {
      return this.sentMail.length > 0 
        ? this.sentMail[this.sentMail.length - 1] 
        : null;
    };
    
    this.getSentMailCount = () => this.sentMail.length;
    
    this._shouldFail = false;
    this._failWithError = null;
    
    this.setShouldFail = (shouldFail, error = null) => {
      this._shouldFail = shouldFail;
      this._failWithError = error || new Error('Mock email send failed');
      return this;
    };
  }
}

const mockTransporter = new MockTransporter();

export { mockTransporter as transporter };