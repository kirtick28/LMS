import app from './app.js';
import connectDB from './config/DB.js';

if (process.env.NODE_ENV !== 'test') {
  connectDB();
}
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
