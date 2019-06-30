# HYU-OMS API Version 3

한양대학교 주문관리시스템은 2014년도에 처음 만들어진 후 매년 학교 축제 주점에서 사용되고 있습니다.  
본 Repository 는 API 서버 코드입니다.

### 개발 역사
  - 2014년
    - 최초 개발, PHP5 기반
    - Facebook, Kakao 로그인 사용
  - 2015년
    - 특별한 업데이트 없음
  - 2016년
    - Front-End 와 Back-End 를 분리
    - Front-End 를 Static Server 를 이용하여 제공하기 시작
    - Front-End 를 AngularJS 를 이용하여 제작. (AngularJS is not an Angular!)
    - Back-End 를 PHP 에서 Node.JS (with [ExpressJS](https://expressjs.com)) 로 변경
    - Social Login 제거
  - 2017년
    - Front-End UI 변경 ([Semantic UI](https://semantic-ui.com) 사용)
    - Front-End 를 [React](https://reactjs.org/) 를 이용하여 제작.
    - Back-End 언어를 Node.JS -> Python3 (with [Flask](http://flask.pocoo.org)) 로 변경
    - Social Login 복원 (Facebook, Kakao)
    - 이 때부터 발생되는 모든 기록을 그대로 유지 중
  - 2018년
    - Back-End 언어는 그대로 유지
    - Front-End UI 변경 ([Material UI](https://material-ui.com) 사용)
  - 2019년
    - Back-End 언어를 Python3 -> Node.JS (with [ExpressJS](https://expressjs.com)) 로 변경
    - Front-End UI 일부 변경 ([Material UI](https://material-ui.com) 는 그대로 유지)
    - 실시간 업데이트를 위해 Socket.IO 도입 시도했으나 Rollback.

### HYU-OMS API 서버를 운영하기 위해 필요한 것들
  - Node.JS 10.x or higher
  - MySQL 5.7 or higher

### 서버를 시작하기 전에 미리 세팅해야 하는 것
`/src` 디렉터리에는 `config.js` 라는 파일이 존재합니다. 이 파일은 설정 파일이며 다음 2가지 방법 중 하나를 선택하실 수 있습니다.
1. 해당 파일의 내용에 필요한 정보를 직접 지정한다.
2. Environment Variable 설정을 통해 정보를 지정한다.

아래 변수들은 서버 시작 전에 반드시 값을 지정하셔야 하며 지정하지 않을 경우 서버가 실행되지 않습니다.  
`v1.mysql.host`, `v1.mysql.user`, `v1.mysql.password`, `v1.mysql.database`, `v1.jwt.secret_key`, `v1.aes.key`

각각의 변수에 대응하는 Environment Variable 은 다음과 같습니다.  
`API_V1_MYSQL_HOST`, `API_V1_MYSQL_USER`, `API_V1_MYSQL_PASSWD`, `API_V1_MYSQL_DB`, `API_V1_JWT_SECRET_KEY`, `API_V1_AES_KEY`

mysql database 는 사전에 생성이 되어 있어야 하며 지정한 유저가 해당 DB 에 대해서 `SELECT`, `INSERT`, `UPDATE`, `DELETE` Query 를 할 수 있도록 권한이 지정되어 있어야 합니다.  
서버가 시작하게 되면 필요한 테이블이 자동으로 생성되게 됩니다.

### 서버 시작하기 (Development)
```sh
$ npm install
$ PORT=[YOUR_CUSTOM_PORT_NUM] npm run start-dev
```

### 서버 시작하기 (Production)
```sh
$ npm install
$ PORT=[YOUR_CUSTOM_PORT_NUM] npm start
```
`npm start` 명령은 `npm run build` 를 우선 시행하게 되며 이 명령의 결과로 build directory 가 생성되게 됩니다.

### 기타 안내
 - 서버는 UTC timezone 을 사용하도록 하드코딩 되어 있습니다. (`/src/scripts/run.js` 의 13번째 줄 참고)
 - Environment Variable `PORT` 값을 지정하지 않을 경우 3000번 포트에서 서버가 가동이 되게 됩니다.
 - 서버가 죽었을 경우 다시 자동으로 시작할 수 있도록 조치를 하는 것을 권장합니다.
   - 저는 [pm2](https://www.npmjs.com/package/pm2) 를 사용합니다.
 - Nginx 를 앞단에 두고 사용하는 것을 권장합니다.

### Todos
 - 실시간 (에 가까운?) 업데이트 기능 추가
   - 이전에는 일정 시간마다 데이터를 새로 받아오게끔 Front-End 쪽 코드에 구현을 해놨는데 이번에는 어떻게 바꿔볼 지 고민 중입니다. Socket.IO 도입을 고려했고 실제로 테스트까지 진행을 해봤으나 네트워크가 불안정한 경우 제 기능을 못하는 듯 하여 일단은 다시 제거했습니다.
 - 일정 시간 내 요청 수 제한
   - 추가 해야 하는데 후순위에 밀려서 자꾸 안하고 있었습니다(...)
 - Push Notification
   - iOS Safari 에서 아직 Web Push 를 지원하지 않아서 보류 중입니다.

### License
여기에 사용된 각종 라이브러리들은 (뭐 당연하지만) 원 프로젝트의 License 를 따라가게 됩니다.  
본 프로젝트에서 생성된 고유 코드는 상업적으로 사용하실 수 없습니다.
