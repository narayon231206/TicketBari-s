import jwt from "jsonwebtoken";

export const generateToken = (user) => {
  return jwt.sign(
    { id: user.id || user._id, email: user.email, role: user.role, status: user.status },
    process.env.JWT_SECRET || "super_secret_jwt_key",
    { expiresIn: "7d" }
  );
};

export const protect = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "super_secret_jwt_key");
      req.user = decoded;
      
      // If user is marked as fraud, deny access
      if (req.user.status === "fraud") {
        return res.status(403).json({ error: "Access denied. Your account is marked as fraud." });
      }
      
      return next();
    } catch (error) {
      return res.status(401).json({ error: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Not authorized, no token" });
  }
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied. Insufficient permissions." });
    }
    next();
  };
};
