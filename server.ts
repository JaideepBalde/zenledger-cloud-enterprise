
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { UserRole, RequestStatus, TransactionType } from './types';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;

// Fixed: cast to any to avoid middleware type mismatch errors in TypeScript with Express overloads.
app.use(cors() as any);
app.use(express.json() as any);

// --- DATABASE MODELS ---
const UserSchema = new mongoose.Schema({
  familyId: { type: String, required: true },
  name: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: Object.values(UserRole), required: true },
  parentId: { type: String },
  isActive: { type: Boolean, default: true }
});
const UserModel = mongoose.model('User', UserSchema);

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: Object.values(TransactionType), required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  timestamp: { type: Number, default: Date.now }
});
const TransactionModel = mongoose.model('Transaction', TransactionSchema);

const MoneyRequestSchema = new mongoose.Schema({
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: Object.values(RequestStatus), default: RequestStatus.PENDING },
  timestamp: { type: Number, default: Date.now }
});
const MoneyRequestModel = mongoose.model('MoneyRequest', MoneyRequestSchema);

const MessageSchema = new mongoose.Schema({
  familyId: { type: String, required: true },
  fromId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromRole: { type: String, required: true },
  toId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  timestamp: { type: Number, default: Date.now },
  isRead: { type: Boolean, default: false }
});
const MessageModel = mongoose.model('Message', MessageSchema);

// --- AUTH MIDDLEWARE ---
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized access.' });
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid authentication token.' });
  }
};

// --- ROUTES ---
app.post('/auth/signup', async (req, res) => {
  const { familyId, handle, password } = req.body;
  const fid = familyId.trim().toLowerCase().replace(/\s+/g, '_');
  const existing = await UserModel.findOne({ familyId: fid, username: handle.toLowerCase() });
  if (existing) return res.status(400).json({ error: 'Identity already established.' });
  
  const user = new UserModel({ familyId: fid, name: handle, username: handle.toLowerCase(), password, role: UserRole.PARENT });
  await user.save();
  res.json(user);
});

app.post('/auth/login', async (req, res) => {
  const { familyId, handle, password } = req.body;
  const user = await UserModel.findOne({ familyId: familyId.toLowerCase(), username: handle.toLowerCase(), password });
  if (!user) return res.status(401).json({ error: 'Access denied. Verify credentials.' });
  
  const token = jwt.sign({ userId: user._id, familyId: user.familyId, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, userId: user._id, familyId: user.familyId, role: user.role, exp: Date.now() + 86400000 });
});

app.get('/users', authenticate, async (req: any, res) => {
  const users = await UserModel.find({ familyId: req.user.familyId });
  res.json(users.map(u => ({ ...u.toObject(), id: u._id })));
});

app.post('/users/child', authenticate, async (req: any, res) => {
  if (req.user.role !== UserRole.PARENT) return res.status(403).json({ error: 'Administrative nodes only.' });
  const { username, password } = req.body;
  const child = new UserModel({ 
    familyId: req.user.familyId, name: username, username: username.toLowerCase(), 
    password, role: UserRole.CHILD, parentId: req.user.userId 
  });
  await child.save();
  res.json(child);
});

app.get('/transactions', authenticate, async (req: any, res) => {
  const users = await UserModel.find({ familyId: req.user.familyId });
  const uids = users.map(u => u._id);
  const txs = await TransactionModel.find({ userId: { $in: uids } }).sort({ timestamp: -1 });
  res.json(txs.map(t => ({ ...t.toObject(), id: t._id })));
});

app.post('/transactions', authenticate, async (req: any, res) => {
  const tx = new TransactionModel({ ...req.body });
  await tx.save();
  res.json(tx);
});

app.get('/requests', authenticate, async (req: any, res) => {
  const users = await UserModel.find({ familyId: req.user.familyId });
  const uids = users.map(u => u._id);
  const requests = await MoneyRequestModel.find({ childId: { $in: uids } }).sort({ timestamp: -1 });
  res.json(requests.map(r => ({ ...r.toObject(), id: r._id })));
});

app.post('/requests', authenticate, async (req: any, res) => {
  const request = new MoneyRequestModel({ ...req.body, childId: req.user.userId });
  await request.save();
  res.json(request);
});

app.patch('/requests/:id', authenticate, async (req: any, res) => {
  if (req.user.role !== UserRole.PARENT) return res.status(403).json({ error: 'Authorization required.' });
  await MoneyRequestModel.findByIdAndUpdate(req.params.id, { status: req.body.status });
  res.json({ success: true });
});

app.get('/messages', authenticate, async (req: any, res) => {
  const messages = await MessageModel.find({ familyId: req.user.familyId }).sort({ timestamp: 1 });
  res.json(messages.map(m => ({ ...m.toObject(), id: m._id })));
});

app.post('/messages', authenticate, async (req: any, res) => {
  const msg = new MessageModel({ ...req.body, fromId: req.user.userId, fromRole: req.user.role, familyId: req.user.familyId });
  await msg.save();
  res.json(msg);
});

app.delete('/system/reset', authenticate, async (req: any, res) => {
  if (req.user.role !== UserRole.PARENT) return res.status(403).json({ error: 'System wipe denied.' });
  const users = await UserModel.find({ familyId: req.user.familyId });
  const uids = users.map(u => u._id);
  await Promise.all([
    UserModel.deleteMany({ familyId: req.user.familyId, role: UserRole.CHILD }),
    TransactionModel.deleteMany({ userId: { $in: uids } }),
    MoneyRequestModel.deleteMany({ childId: { $in: uids } }),
    MessageModel.deleteMany({ familyId: req.user.familyId })
  ]);
  res.json({ success: true });
});

// --- SERVER START ---
mongoose.connect(MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`Institutional node established on port ${PORT}`));
}).catch(err => console.error('Database cluster connection failure:', err));
