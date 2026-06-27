import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/suitesops';
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[db] Connected to MongoDB: ${mongoose.connection.name}`);

    mongoose.connection.on('error', (err) =>
      console.error('[db] connection error:', err.message)
    );
    mongoose.connection.on('disconnected', () =>
      console.warn('[db] disconnected from MongoDB')
    );
  } catch (err) {
    console.error('[db] MongoDB connection error:', err.message);
    process.exit(1);
  }
}

export default connectDB;
