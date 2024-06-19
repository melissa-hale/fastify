import Fastify from 'fastify';
import fastifyEtag from '@fastify/etag';

interface User {
  name: string;
  email: string;
}

const users: Record<string, User> = {
  'one': { name: 'Alice', email: 'alice@email.com' },
  'two': { name: 'Bob', email: 'bob@email.com' }
};

const fastify = Fastify();

fastify.register(fastifyEtag);

fastify.get('/my-info', async (request, reply) => {
  // this "authentication" is for educational purposes only!
  const [, token] = request.headers.authorization?.split(' ') || ['', ''];
  const user = users[token.substr('user:'.length)];

  if (!user) {
    return reply.code(403).send('UNAUTHORIZED');
  }

  reply.type('application/json');
  // it will be cached on CDN for 30 seconds, and on client for 60
  // the request cache use depends on "Authorization" content
  reply.headers({
    'cache-control': 's-maxage=30,max-age=60',
    vary: 'authorization'
  });

  reply.send({
    ...user,
    mobile: request.headers['cloudfront-is-mobile-viewer'],
    country: request.headers['cloudfront-viewer-country'],
    city: request.headers['cloudfront-viewer-city'],
    lat: request.headers['cloudfront-viewer-latitude'],
    lng: request.headers['cloudfront-viewer-longitude']
  });
});

const start = async () => {
  try {
    await fastify.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
    console.log(`Server is running at PORT:${Number(process.env.PORT) || 3000}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
