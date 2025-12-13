# DoodleX Production Deployment Guide

## ✅ Current Deployment Status

### Backend (Render)
- **URL**: https://doodlex-backend.onrender.com
- **Status**: ✅ Live and healthy
- **Health Check**: https://doodlex-backend.onrender.com/health
- **Current Stats**:
  - Uptime: 924s
  - Active rooms: 1
  - Connections: 1

### Frontend (Vercel - if deployed)
- **Expected URL**: https://doodlex.vercel.app
- **Status**: To be confirmed

---

## 🔧 Environment Variables

### Required on Render (Backend)

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# CORS - Must include all frontend URLs
CORS_ORIGINS=https://doodlex.vercel.app,https://doodlex-backend.onrender.com,http://localhost:5173

# MongoDB Connection
MONGODB_URI=mongodb+srv://DoodleX:DoodleX%402873@cluster0.cywwieh.mongodb.net/?appName=Cluster0

# Admin API Key
ADMIN_KEY=your-secret-admin-key-here
```

### Required on Vercel (Frontend)

```env
# Backend URL
VITE_SERVER_URL=https://doodlex-backend.onrender.com

# Optional: Custom TURN server for voice chat
VITE_TURN_SERVER=turn:openrelay.metered.ca
VITE_TURN_USERNAME=openrelayproject
VITE_TURN_CREDENTIAL=openrelayproject
```

---

## 📱 Mobile App Configuration

Update `client-mobile/App.js` or constants:

```javascript
const SERVER_URL = 'https://doodlex-backend.onrender.com';
```

---

## 🚀 Deployment Checklist

### Backend (Render) ✅
- [x] Deployed to Render
- [x] Health endpoint working
- [x] MongoDB connected
- [x] CORS configured
- [ ] Environment variables set on Render dashboard
- [ ] SSL/HTTPS enabled (automatic on Render)

### Frontend (Vercel)
- [ ] Deploy web client to Vercel
- [ ] Set `VITE_SERVER_URL` environment variable
- [ ] Update CORS on backend to include Vercel URL
- [ ] Test connection between frontend and backend

### Mobile (Optional)
- [ ] Update SERVER_URL in mobile app
- [ ] Rebuild APK/IPA with production URL
- [ ] Test on physical devices

---

## 🔍 Testing Your Deployment

### 1. Test Backend Health
```bash
curl https://doodlex-backend.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2025-12-13T...",
  "rooms": 0,
  "connections": 0
}
```

### 2. Test WebSocket Connection
Open browser console on your frontend and check:
```javascript
// Should see in console:
Connected to server
✅ MongoDB connected successfully
```

### 3. Test Game Functionality
- ✅ Create room
- ✅ Join room
- ✅ Start game
- ✅ Drawing syncs in real-time
- ✅ Voice chat works
- ✅ Rooms persist (check MongoDB)

---

## 🐛 Common Issues & Solutions

### Issue: CORS Error
**Symptom**: `Access to XMLHttpRequest has been blocked by CORS policy`

**Solution**: Add frontend URL to `CORS_ORIGINS` on Render:
```env
CORS_ORIGINS=https://doodlex.vercel.app,https://your-frontend-url.com
```

### Issue: MongoDB Connection Failed
**Symptom**: Server logs show `⚠️ Using in-memory storage`

**Solution**: 
1. Verify `MONGODB_URI` is set in Render environment variables
2. Check MongoDB Atlas allows connections from `0.0.0.0/0` (or Render IPs)
3. Verify username/password in connection string

### Issue: WebSocket Connection Failed
**Symptom**: Frontend can't connect to backend

**Solution**:
1. Check backend URL is correct (https, not http)
2. Verify Render service is running
3. Check browser console for specific errors

### Issue: Voice Chat Not Working
**Symptom**: Players can't hear each other

**Solution**:
1. Check TURN server credentials
2. Test on HTTPS (WebRTC requires secure context)
3. Check browser microphone permissions

---

## 📊 Monitoring

### Backend Metrics
- **Render Dashboard**: https://dashboard.render.com
- **Health Endpoint**: https://doodlex-backend.onrender.com/health
- **MongoDB Atlas**: Monitor connections and queries

### Logs
- **Render Logs**: Available in Render dashboard
- **Client Logs**: Browser console (F12)

---

## 🔐 Security Recommendations

### Completed ✅
- [x] MongoDB credentials in environment variables
- [x] TURN credentials configurable via env vars
- [x] HTML sanitization for chat messages
- [x] Rate limiting on guesses and strokes
- [x] Input validation

### Recommended
- [ ] Add authentication for players (optional)
- [ ] Implement room passwords (optional)
- [ ] Add admin dashboard with proper auth
- [ ] Rate limit room creation
- [ ] Add DDoS protection (Cloudflare)

---

## 📈 Scaling Considerations

### Current Setup (MVP)
- ✅ Single Render instance
- ✅ MongoDB Atlas (shared cluster)
- ✅ In-memory socket connections
- ✅ Auto-scaling on Render

### For High Traffic
1. **Redis for session storage** (replace in-memory Maps)
2. **Horizontal scaling** (multiple Render instances)
3. **CDN for static assets** (Cloudflare/Vercel)
4. **Dedicated MongoDB cluster**
5. **WebSocket load balancer**

---

## 🎯 Next Steps

1. **Deploy Frontend to Vercel**
   ```bash
   cd client-web
   vercel --prod
   ```

2. **Update Environment Variables**
   - Add Vercel URL to Render CORS_ORIGINS
   - Set VITE_SERVER_URL on Vercel

3. **Test End-to-End**
   - Create room on production frontend
   - Join from mobile app
   - Test all features

4. **Monitor Performance**
   - Watch Render metrics
   - Check MongoDB usage
   - Monitor error logs

---

## 📞 Support Resources

- **Render Docs**: https://render.com/docs
- **MongoDB Atlas**: https://www.mongodb.com/docs/atlas/
- **Vercel Docs**: https://vercel.com/docs
- **Socket.IO**: https://socket.io/docs/

---

## ✨ Deployment Complete!

Your DoodleX backend is live at:
**https://doodlex-backend.onrender.com**

Backend health: ✅ Operational  
MongoDB: ✅ Connected  
WebSocket: ✅ Ready  

Ready to handle multiplayer drawing games! 🎨
