import Fastify from 'fastify';
import fastifyEtag from '@fastify/etag';
import { MongoClient, Db, ObjectId } from 'mongodb';

interface User {
  _id: ObjectId;
  name: string;
  email: string;
}

const fastify = Fastify();
fastify.register(fastifyEtag);

let db: Db;

// Function to connect to MongoDB
const connectToMongo = async () => {
  const mongoUri = process.env.MONGO_PRIVATE_URL;
  if (!mongoUri) {
    throw new Error('MONGO_PRIVATE_URL environment variable is not set');
  }

  console.log('Connecting to MongoDB...');
  const client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db('test'); // Replace with your database name
  console.log('Connected to MongoDB');
};

// Middleware to connect to MongoDB before handling requests
fastify.addHook('onRequest', async (request, reply) => {
  if (!db) {
    console.log('Database connection not initialized. Connecting...');
    await connectToMongo();
  } else {
    console.log('Database connection already established.');
  }
});

fastify.get('/my-info', async (request, reply) => {
  // this "authentication" is for educational purposes only!
  const [, token] = request.headers.authorization?.split(' ') || ['', ''];
  const userId = token.substr('user:'.length);

  console.log(`Received request for user: ${userId}`);

  try {
    const user = await db.collection<User>('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
      console.log(`User with ID ${userId} not found.`);
      return reply.code(403).send('UNAUTHORIZED');
    }

    console.log(`User with ID ${userId} found: ${JSON.stringify(user)}`);

    reply.type('application/json');
    // it will be cached on CDN for 30 seconds, and on client for 60
    // the request cache use depends on "Authorization" content
    reply.headers({
      'cache-control': 's-maxage=86400,max-age=1800',
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
  } catch (err) {
    console.error(`Error processing request for user ${userId}:`, err);
    reply.code(500).send('Internal Server Error');
  }
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
