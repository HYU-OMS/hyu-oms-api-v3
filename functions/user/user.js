import rp from 'request-promise-native';
import uuid4 from 'uuid/v4';
import jwt from 'jsonwebtoken';

export const create = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  /* POST 로 들어온 JSON data 를 받는다. */
  let content = undefined;
  try {
    /* parse 실패 시 exception handling 을 하게 되며, 아무런 데이터가 없을 경우 {} 를 대신 assign. */
    content = JSON.parse(event.body) || {};
  }
  catch(err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Unable to parse requested body!",
        status: "JSON_PARSE_ERR"
      })
    };
  }

  const type = content['type'];
  if(type === 'facebook') {
    /* Facebook API access token 을 받는다. */
    const access_token = content['access_token'];
    if(Boolean(access_token) === false) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "'access_token' must be provided!",
          status: "REQUIRED_VALUE_ERR",
          value: ['access_token']
        }),
      };
    }

    /* API 서버에 요청할 정보 설정 */
    const options = {
      "method": "GET",
      "uri": "https://graph.facebook.com/v2.9/me",
      "qs": {
        "access_token": access_token,
        "fields": "id,name"
      },
      "resolveWithFullResponse": true
    };

    /* API 서버로부터 정보를 받아온다. */
    let fb_profile = undefined;
    try {
      const resp = await rp(options);
      const resp_body = resp['body'];

      fb_profile = JSON.parse(resp_body);
    }
    catch(err) {
      const resp = err['response'];
      const resp_body = JSON.parse(resp['body']);

      const status_code = parseInt(resp['statusCode'], 10) || 500;
      const message = resp_body['error']['message'] || "Facebook API Server Error!";

      return {
        statusCode: status_code,
        body: JSON.stringify({
          message: message,
          status: "FACEBOOK_API_ERR",
          value: ['facebook']
        })
      };
    }

    /* Facebook 유저 고유번호를 받는다. */
    const fb_id = parseInt(fb_profile['id'], 10);

    /* 혹시나 fb_id 확인이 불가능할 경우. */
    if(isNaN(fb_id) === true) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Unable to resolve Facebook user info!",
          status: "FACEBOOK_API_ERR",
          value: []
        })
      };
    }

    /* Facebook 유저 이름을 받는다. */
    const fb_nick = fb_profile['name'];

    /* TODO: DB connect & data transfer 코드 삽입 예정 */

    /* UUID 생성 */
    const auth_uuid = uuid4();

    /* JWT 생성 */
    const jwt_token = jwt.sign({

    }, "JWT_SECRET_KEY", {
      algorithm: "",
      expiresIn: "24h"
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        jwt: jwt_token
      })
    };
  }
  else if(type === 'kakao') {
    /* Kakao API access token 을 받는다. */
    const access_token = content['access_token'];
    if(Boolean(access_token) === false) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "'access_token' must be provided!",
          status: "REQUIRED_VALUE_ERR",
          value: ['access_token']
        }),
      };
    }

    /* Kakao API Server 에 요청을 보내기 위한 옵션 */
    const options = {
      "method": "GET",
      "uri": "https://kapi.kakao.com/v1/user/me",
      "headers": {
        "Authorization": "Bearer " + access_token
      },
      "resolveWithFullResponse": true
    };

    // Kakao 유저 정보를 받아온다.
    let kakao_profile = undefined;
    try {
      const resp = await rp(options);
      const resp_body = kakao_resp['body'];

      kakao_profile = JSON.parse(resp_body);
    } catch(err) {
      const resp = err['response']; // response object 를 받는다.
      const resp_body = JSON.parse(resp['body']); // response body 를 받아 JSON parse 진행한다.

      const status_code = parseInt(resp['statusCode'], 10) || 500;
      const message = resp_body['msg'] || "Kakao API Server Error!";

      return {
        statusCode: status_code,
        body: JSON.stringify({
          message: message,
          status: "KAKAO_API_ERR",
          value: ['kakao']
        })
      };
    }

    /* Kakao 유저 고유번호를 받는다. */
    const kakao_id = parseInt(kakao_profile['id'], 10);

    /* 혹시나 fb_id 확인이 불가능할 경우. */
    if(isNaN(kakao_id) === true) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Unable to resolve Facebook user info!",
          status: "KAKAO_API_ERR",
          value: []
        })
      };
    }

    /* Kakao 유저 닉네임을 받는다. */
    const kakao_nick = kakao_profile['properties']['nickname'];

    /* TODO: DB connect & data transfer 코드 삽입 예정 */

    /* UUID 생성 */
    const auth_uuid = uuid4();

    /* JWT 생성 */
    const jwt_token = jwt.sign({

    }, "JWT_SECRET_KEY", {
      algorithm: "",
      expiresIn: "24h"
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        jwt: jwt_token
      })
    };
  }
  else {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "'type' must be either 'facebook' or 'kakao'!",
        status: "REQUIRED_VALUE_ERR",
        value: ['type']
      }),
    };
  }
};