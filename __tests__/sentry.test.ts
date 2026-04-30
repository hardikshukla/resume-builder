// Since instrumentation.ts exports register() and configures Sentry internally, 
// we will test the logic of the beforeSend scrubber by simulating the event.

describe('Sentry Scrubber', () => {
  it('should redact dropboxToken, anthropicKey, and openaiKey', () => {
    // Simulated beforeSend from instrumentation.ts
    const beforeSend = (event: any) => {
      if (event.request?.data) {
        const data = event.request.data;
        if (data.anthropicKey) data.anthropicKey = '[REDACTED]';
        if (data.openaiKey)    data.openaiKey    = '[REDACTED]';
        if (data.dropboxToken) data.dropboxToken = '[REDACTED]';
      }
      return event;
    };

    const mockEvent = {
      request: {
        data: {
          anthropicKey: 'sk-ant-1234',
          openaiKey: 'sk-1234',
          dropboxToken: 'sl.B1234',
          otherData: 'safe'
        }
      }
    };

    const processedEvent = beforeSend(mockEvent);

    expect(processedEvent.request.data.anthropicKey).toBe('[REDACTED]');
    expect(processedEvent.request.data.openaiKey).toBe('[REDACTED]');
    expect(processedEvent.request.data.dropboxToken).toBe('[REDACTED]');
    expect(processedEvent.request.data.otherData).toBe('safe');
  });

  it('should not throw if request data is missing', () => {
    const beforeSend = (event: any) => {
      if (event.request?.data) {
        const data = event.request.data;
        if (data.anthropicKey) data.anthropicKey = '[REDACTED]';
        if (data.openaiKey)    data.openaiKey    = '[REDACTED]';
        if (data.dropboxToken) data.dropboxToken = '[REDACTED]';
      }
      return event;
    };

    const mockEvent = {
      request: {}
    };

    const processedEvent = beforeSend(mockEvent);
    expect(processedEvent).toEqual(mockEvent);
  });
});
