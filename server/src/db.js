import mongoose from 'mongoose';
import { config } from './config.js';

export async function connectDatabase() {
  let uri = config.mongoUri;

  if (uri === 'memory') {
    // Throwaway database for trying the app without installing MongoDB.
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('docs-reader');
    console.log('Using in-memory MongoDB (data is lost on restart)');
  }

  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}
