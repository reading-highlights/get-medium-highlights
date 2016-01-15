console.log('Loading function.');

// Load config
var config = require('./config.json');

// Load dependencies
var Promise = require('bluebird');
var rest = require('restler');
var AWS = require('aws-sdk');
AWS.config.loadFromPath('./config.json');
var sns = new AWS.SNS();
var publishQuoteToSns = Promise.promisify(sns.publish, {context: sns});

// Get Medium.com highlights
exports.handler = function(event, context) {
  console.log('Received event:', JSON.stringify(event, null, 2));

  var url = 'https://medium.com/_/api/users/' + config.user + '/quotes?limit=' + config.limit;
  rest.get(url, {
    parser: mediumJSONParser,
    headers: { 'Authorizatoin': 'Bearer ' + config.token }
  }).on('success', function(data) {
    // console.log(data);

    var site = 'https://medium.com';

    var quoteCount = 0;
    Promise.each(data.payload.value, function(q) {
      // construct quote object
      var quote = {
        text: q.paragraphs[0].text.substring(q.startOffset, q.endOffset),
        link: site + '/posts/' + q.postId + '#' + q.paragraphs[0].name,
        createdAt: q.createdAt,
        post: {
          title: q.post.title,
          link: site + '/posts/' + q.postId,
          author: {
            name: q.post.creator.name,
            link: site + '/@' + q.post.creator.username
          },
          siteLink: site
        }
      };

      quoteCount++;
      return publishQuoteToSns({Message: JSON.stringify(quote), TopicArn: config.snsArn});

    }).then(function() {
      console.log('' + quoteCount + ' quote(s) published to SNS');
      process.exit();
      context.succeed();
    }).catch(function(error) {
      console.log(error);
      context.fail();
    });
  });
};

var mediumJSONParser = function(data, callback) {
  if (data && data.length) {
    var parsedData;
    try {
      parsedData = JSON.parse(data.toString('utf8').replace(/^\]\)\}while\(1\);<\/x>/, ''));
    } catch (err) {
      err.message = 'Failed to parse JSON body: ' + err.message;
      callback(err, null);
    }
    if (parsedData !== 'undefined') {
      callback(null, parsedData);
    }
  } else {
    callback(null, null);
  }
};

// var context = {
//   fail: function(msg) {
//     console.log('Error:');
//     console.log(msg);
//   },
//   succeed: function(msg) {
//     console.log(msg);
//   }
// };
//
// exports.handler(null, context);
