import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { config } from "./config";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

/**
 * Hash a password using scrypt and salt
 * @param password Plain text password to hash
 * @returns Hash+salt string in format "hash.salt"
 */
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

/**
 * Safely compare a supplied password against a stored hashed password
 * @param supplied Plain text password provided by the user
 * @param stored Hashed password stored in the database
 * @returns Boolean indicating if passwords match
 */
export async function comparePasswords(supplied: string, stored: string) {
  try {
    // Check if the stored password contains a salt (has a dot)
    if (!stored.includes('.')) {
      // Legacy support for plaintext passwords - for migration only
      // This allows old admin accounts to still login during the transition
      return supplied === stored;
    }
    
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
}

/**
 * Custom middleware to check if user has required role
 * @param roles Array of roles that are allowed to access the route
 * @returns Express middleware function
 */
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log("requireRole middleware called with roles:", roles);
    console.log("Authentication status:", req.isAuthenticated());
    
    if (!req.isAuthenticated()) {
      console.log("User not authenticated");
      return res.status(401).json({ error: "Not authenticated" });
    }

    console.log("User in requireRole middleware:", req.user);
    const userRole = req.user.role;
    console.log("User role:", userRole, "Allowed roles:", roles);
    
    if (!roles.includes(userRole)) {
      console.log("Insufficient permissions. User role:", userRole, "Required roles:", roles);
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    console.log("Role check passed");
    next();
  };
}

/**
 * Setup authentication for the application
 * @param app Express application
 */
export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "wakeboard-booking-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: { 
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Google strategy for OAuth login
  passport.use(
    new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: config.googleCallbackUrl,
      scope: ["profile", "email"]
    }, 
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google auth callback received for profile:", profile.displayName);
        
        // Extract email from profile
        const email = profile.emails && profile.emails[0] && profile.emails[0].value;
        if (!email) {
          console.log("No email provided by Google");
          return done(null, false, { message: "No email provided by Google" });
        }
        
        // Check if user exists
        let user = await storage.getUserByEmail(email);
        
        if (user) {
          console.log("Existing user found with email:", email);
          
          // Update last login time
          await storage.updateUserLastLogin(user.id);
          
          return done(null, user);
        } else {
          console.log("Creating new user from Google profile:", profile.displayName);
          
          // Create a new user with Google profile data
          // Generate a random password that the user won't need to use
          const randomPassword = await hashPassword(randomBytes(16).toString('hex'));
          
          const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || '';
          const lastName = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '';
          
          const newUser = await storage.createUser({
            email: email,
            username: email.split('@')[0], // Use part of email as username
            password: randomPassword,
            role: "athlete", // Default role for Google sign-ups
            firstName: firstName,
            lastName: lastName,
            isActive: true
          });
          
          console.log("Created new user from Google auth:", newUser.email);
          return done(null, newUser);
        }
      } catch (error) {
        console.error("Error during Google authentication:", error);
        return done(error as Error);
      }
    })
  );

  // Configure local strategy for username/email & password login
  passport.use(
    new LocalStrategy({ 
      usernameField: 'email' // Use email as the username field
    }, async (email, password, done) => {
      try {
        console.log("Login attempt with email:", email);
        const user = await storage.getUserByEmail(email);
        
        if (!user) {
          console.log("User not found with email:", email);
          return done(null, false, { message: "Invalid email or password" });
        }
        
        if (!user.isActive) {
          console.log("User account is inactive:", email);
          return done(null, false, { message: "Account is inactive" });
        }
        
        console.log("User found, checking password");
        const passwordMatches = await comparePasswords(password, user.password);
        
        if (!passwordMatches) {
          console.log("Password does not match");
          return done(null, false, { message: "Invalid email or password" });
        }
        
        // Update last login time
        await storage.updateUserLastLogin(user.id);
        
        console.log("Password matches, login successful");
        return done(null, user);
      } catch (error) {
        console.error("Error during authentication:", error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Create a default admin user if none exists
  console.log("Checking for admin user...");
  (async () => {
    try {
      const adminExists = await storage.adminUserExists();
      if (!adminExists) {
        console.log("No admin user found, creating one...");
        // Create admin with secure hashed password
        const hashedPassword = await hashPassword("wakeboard2023");
        await storage.createUser({ 
          email: "admin@hiwake.lv",
          username: "admin", 
          password: hashedPassword,
          role: "admin",
          firstName: "Admin",
          lastName: "User",
          isActive: true
        });
        console.log("Default admin user created successfully");
      } else {
        console.log("Admin user already exists");
      }
    } catch (error) {
      console.error("Error checking/creating admin user:", error);
    }
  })();

  // Athlete bookings endpoint
  app.get("/api/user/bookings", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Get bookings for the authenticated user
      const userEmail = req.user?.email;
      if (!userEmail) {
        return res.status(400).json({ error: "User email not found" });
      }
      const bookings = await storage.getBookingsByEmail(userEmail);
      
      // Get time slots for each booking and calculate totalPrice if missing
      const bookingsWithTimeSlots = await Promise.all(
        bookings.map(async (booking) => {
          const timeSlots = await storage.getBookingTimeSlots(booking.id);
          
          // Calculate total price if it doesn't exist
          let totalPrice = booking.totalPrice;
          if (totalPrice === undefined || totalPrice === null) {
            totalPrice = timeSlots.reduce((sum, slot) => {
              const slotPrice = typeof slot.price === 'number' ? slot.price : 0;
              return sum + slotPrice;
            }, 0);
          }
          
          return { ...booking, timeSlots, totalPrice };
        })
      );
      
      res.json(bookingsWithTimeSlots);
    } catch (error) {
      console.error("Error fetching user bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // User management endpoints (protected)
  app.get("/api/users", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // If user is manager, filter out admin users
      let filteredUsers = users;
      if (req.user.role === 'manager') {
        filteredUsers = users.filter(user => user.role !== 'admin');
      }
      
      // Don't send passwords to client
      const safeUsers = filteredUsers.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Create new user (admin or manager)
  app.post("/api/users", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      // Validate the input
      const createUserSchema = insertUserSchema
        .omit({ id: true, createdAt: true, lastLogin: true })
        .extend({
          password: z.string().min(8, "Password must be at least 8 characters")
        });
        
      const validatedData = createUserSchema.parse(req.body);
      
      // If user is a manager and tries to create an admin, prevent it
      if (req.user.role === 'manager' && validatedData.role === 'admin') {
        return res.status(403).json({ error: "Managers cannot create admin users" });
      }
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already in use" });
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(validatedData.password);
      
      // Create the user with hashed password
      const newUser = await storage.createUser({
        ...validatedData,
        password: hashedPassword
      });
      
      // Don't return the password
      const { password, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Handle validation errors
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Update user (admin only)
  app.put("/api/users/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if the user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Define update schema (password is optional for updates)
      const updateUserSchema = insertUserSchema
        .omit({ id: true, createdAt: true, lastLogin: true })
        .extend({
          password: z.string().min(8).optional(),
        })
        .partial(); // Make all fields optional for partial updates
        
      const validatedData = updateUserSchema.parse(req.body);
      
      // If email is being changed, check it's not already in use
      if (validatedData.email && validatedData.email !== existingUser.email) {
        const emailExists = await storage.getUserByEmail(validatedData.email);
        if (emailExists) {
          return res.status(400).json({ error: "Email already in use" });
        }
      }
      
      // Hash the password if provided
      if (validatedData.password) {
        validatedData.password = await hashPassword(validatedData.password);
      }
      
      // Update the user
      const updatedUser = await storage.updateUser(userId, validatedData);
      
      // Don't return the password
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Authentication endpoints
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      
      if (!user) {
        return res.status(401).json({ 
          message: info?.message || "Authentication failed" 
        });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        // Don't send the password back to the client
        const { password, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    // Don't return the password
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });
  
  // Google OAuth routes
  app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
  
  // Using the original callback path that's registered in Google Cloud Console
  app.get("/api/auth/google/callback", 
    passport.authenticate("google", { 
      failureRedirect: "/auth",
      session: true
    }),
    (req, res) => {
      // Successful authentication, redirect to home
      res.redirect("/");
    }
  );
  
  // Reset password for a user (admin only)
  app.post("/api/users/:id/reset-password", requireRole(["admin"]), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { password } = req.body;
      
      if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      
      // Check if the user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(password);
      
      // Update only the password
      await storage.updateUser(userId, { password: hashedPassword });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });
}
