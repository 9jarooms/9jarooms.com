# Supabase Storage Security Guide

To fix the insecure file uploads vulnerability, please log in to your **Supabase Dashboard** and apply the following restrictions to your `property-media` bucket:

1. Navigate to **Storage** -> **Policies** in your Supabase project.
2. Select your `property-media` bucket.
3. Under **Configuration**, edit the bucket settings:
   - Make sure it is still a **Public** bucket (so images can be viewed).
   - Scroll down to **Allowed MIME types**.
   - Input exactly the following formats:
     ```
     image/jpeg, image/png, image/webp, image/gif
     ```
   - Set the **Maximum file size limit** to **10MB** (`10485760` bytes).
4. Save the configuration.

*This will enforce file validation directly at the database level, preventing anyone from bypassing the frontend React checks to upload malicious executables or extremely large files.*
