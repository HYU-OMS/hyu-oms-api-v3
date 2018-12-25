export const hello = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'HYU-OMS API is online!'
    }),
  };
};