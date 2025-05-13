# Google One Tap Authentication Implementation Specification

## Overview

Google One Tap provides a streamlined authentication experience by allowing users to sign in with their Google account using a single click, without being redirected away from the application. This document outlines the technical specifications and implementation details for integrating Google One Tap authentication into the WakeBook application.

## Key Features

- One-click Google authentication without page redirects
- Automatic user detection for returning Google-authenticated users
- Seamless integration with existing booking flow
- Preservation of user context during authentication

## Technical Requirements

### Google Cloud Console Configuration

1. Update the existing Google OAuth credentials in Google Cloud Console:
   - Enable Google Identity Services API
   - Add authorized JavaScript origins for Google One Tap
   - Configure consent screen settings for One Tap display

### Client-Side Implementation

1. Include Google Identity Services library:
   ```html
   <script src="https://accounts.google.com/gsi/client" async defer></script>
   ```

2. Configure the One Tap initialization:
   ```javascript
   google.accounts.id.initialize({
     client_id: 'YOUR_GOOGLE_CLIENT_ID',
     callback: handleCredentialResponse,
     auto_select: true,
     cancel_on_tap_outside: false
   });
   
   google.accounts.id.prompt();
   ```

3. Implement the credential handling function:
   ```javascript
   function handleCredentialResponse(response) {
     const idToken = response.credential;
     
     // Send token to backend for verification
     fetch('/api/auth/google-one-tap', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({ credential: idToken }),
     })
     .then(response => response.json())
     .then(data => {
       // Handle successful login
       if (data.success) {
         // Update UI or redirect as needed
         window.location.reload();
       }
     })
     .catch(error => {
       console.error('Authentication error:', error);
     });
   }
   ```

4. Add UI display logic:
   ```javascript
   // Display One Tap on specific pages
   if (window.location.pathname === '/booking' || window.location.pathname === '/') {
     google.accounts.id.prompt();
   }
   
   // Customize button placement
   google.accounts.id.renderButton(
     document.getElementById('google-one-tap-container'),
     { theme: 'outline', size: 'large' }
   );
   ```

### Server-Side Implementation

1. Create a new authentication endpoint:
   ```javascript
   app.post('/api/auth/google-one-tap', async (req, res) => {
     const { credential } = req.body;
     
     try {
       // Verify the Google ID token
       const ticket = await client.verifyIdToken({
         idToken: credential,
         audience: YOUR_GOOGLE_CLIENT_ID
       });
       
       const payload = ticket.getPayload();
       const email = payload.email;
       
       // Check if user exists or create a new one
       let user = await storage.getUserByEmail(email);
       
       if (!user) {
         // Create new user with Google profile info
         user = await storage.createUser({
           email,
           username: email.split('@')[0],
           firstName: payload.given_name,
           lastName: payload.family_name,
           password: crypto.randomBytes(20).toString('hex'),
           role: 'athlete',
           isActive: true
         });
       }
       
       // Log in the user by creating a session
       req.login(user, (err) => {
         if (err) {
           return res.status(500).json({ error: 'Authentication error' });
         }
         return res.json({ success: true, user });
       });
     } catch (error) {
       console.error('Google One Tap verification error:', error);
       res.status(401).json({ error: 'Invalid token' });
     }
   });
   ```

2. Modify User Management:
   - Update storage interface to support email lookups
   - Add methods to handle Google-authenticated users

### Integration with Booking Flow

1. Preserve booking context during authentication:
   - Continue using localStorage to store selected time slots
   - Add handling for One Tap authentication completion
   - Update UI to show authentication status

2. Implement post-authentication flow:
   - Retrieve saved booking state after successful authentication
   - Continue with booking process without disruption

## User Experience Considerations

1. **First-time Users**: For users who have never logged in before, the One Tap UI will appear with a compact modal showing their Google profile.

2. **Returning Users**: Users who have previously authenticated will see an even more streamlined experience with automatic sign-in suggestion.

3. **Mobile Experience**: On mobile devices, the One Tap UI will be optimized for touch interaction and limited screen space.

4. **Multi-account Handling**: For users with multiple Google accounts, the One Tap UI will allow account selection.

## Security Considerations

1. **Token Verification**: All ID tokens must be verified on the server side before authentication.

2. **Session Management**: Maintain secure session handling consistent with existing authentication flow.

3. **Scope Limitations**: Request minimal permissions required for user identification.

4. **Privacy Policy**: Update application privacy policy to reflect Google One Tap usage.

## Implementation Phases

1. **Phase 1**: Setup Google Cloud Console configuration and basic client integration
2. **Phase 2**: Implement server-side token verification and user management
3. **Phase 3**: Integrate with booking workflow and optimize user experience
4. **Phase 4**: Testing and performance optimization

## Compatibility Considerations

- Works best in Chrome and other modern browsers
- Falls back to standard OAuth flow in unsupported browsers
- Requires cookies to be enabled in the browser

## Conclusion

Implementing Google One Tap authentication will significantly improve the user experience by reducing friction in the authentication process. This streamlined approach will help maintain context during the booking flow and enhance overall usability of the WakeBook application.