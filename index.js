import authentication from './authentication';
//import multitenancy from './multitenancy';

module.exports = function (kibana) {
  return [
    authentication(kibana),
    //multitenancy(kibana)
  ];
};
