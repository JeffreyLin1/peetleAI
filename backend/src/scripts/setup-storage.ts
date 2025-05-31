import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setupSupabaseStorage() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🚀 Setting up Supabase Storage buckets...\n');

  try {
    // Create buckets
    const buckets = [
      {
        name: 'generated-content',
        public: true,
        description: 'Generated videos, audio, and images'
      },
      {
        name: 'user-content',
        public: true,
        description: 'User-uploaded placeholder images'
      },
      {
        name: 'video-assets',
        public: true,
        description: 'Static video assets (backgrounds, characters)'
      }
    ];

    for (const bucket of buckets) {
      console.log(`📦 Creating bucket: ${bucket.name}`);
      
      const { data, error } = await supabase.storage.createBucket(bucket.name, {
        public: bucket.public,
        allowedMimeTypes: bucket.name === 'generated-content' 
          ? ['video/mp4', 'audio/mpeg', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
          : bucket.name === 'user-content'
          ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
          : ['video/mp4', 'image/png', 'image/jpeg'],
        fileSizeLimit: bucket.name === 'generated-content' ? 100 * 1024 * 1024 : 10 * 1024 * 1024 // 100MB for generated, 10MB for others
      });

      if (error && !error.message.includes('already exists')) {
        console.error(`❌ Failed to create bucket ${bucket.name}:`, error.message);
      } else if (error?.message.includes('already exists')) {
        console.log(`✅ Bucket ${bucket.name} already exists`);
      } else {
        console.log(`✅ Created bucket: ${bucket.name}`);
      }
    }

    console.log('\n🔐 Setting up storage policies...\n');

    // Storage policies for security
    const policies = [
      {
        bucket: 'generated-content',
        name: 'Public read access for generated content',
        definition: `
          CREATE POLICY "Public read access for generated content" ON storage.objects
          FOR SELECT USING (bucket_id = 'generated-content');
        `
      },
      {
        bucket: 'generated-content',
        name: 'Authenticated users can upload generated content',
        definition: `
          CREATE POLICY "Authenticated users can upload generated content" ON storage.objects
          FOR INSERT WITH CHECK (bucket_id = 'generated-content' AND auth.role() = 'authenticated');
        `
      },
      {
        bucket: 'user-content',
        name: 'Public read access for user content',
        definition: `
          CREATE POLICY "Public read access for user content" ON storage.objects
          FOR SELECT USING (bucket_id = 'user-content');
        `
      },
      {
        bucket: 'user-content',
        name: 'Users can upload their own content',
        definition: `
          CREATE POLICY "Users can upload their own content" ON storage.objects
          FOR INSERT WITH CHECK (
            bucket_id = 'user-content' 
            AND auth.uid()::text = (storage.foldername(name))[1]
          );
        `
      },
      {
        bucket: 'user-content',
        name: 'Users can delete their own content',
        definition: `
          CREATE POLICY "Users can delete their own content" ON storage.objects
          FOR DELETE USING (
            bucket_id = 'user-content' 
            AND auth.uid()::text = (storage.foldername(name))[1]
          );
        `
      },
      {
        bucket: 'video-assets',
        name: 'Public read access for video assets',
        definition: `
          CREATE POLICY "Public read access for video assets" ON storage.objects
          FOR SELECT USING (bucket_id = 'video-assets');
        `
      }
    ];

    // Note: RLS policies need to be created via SQL in Supabase dashboard
    console.log('📋 Please create the following RLS policies in your Supabase dashboard:\n');
    
    policies.forEach((policy, index) => {
      console.log(`${index + 1}. Policy for ${policy.bucket}: "${policy.name}"`);
      console.log(`   SQL: ${policy.definition.trim()}\n`);
    });

    console.log('🎯 Storage setup complete! Next steps:\n');
    console.log('1. Go to your Supabase dashboard > Storage');
    console.log('2. Verify the buckets were created');
    console.log('3. Go to Storage > Policies and create the RLS policies listed above');
    console.log('4. Upload your static assets (background video, character images) to the video-assets bucket');
    console.log('5. Set the following environment variables:');
    console.log('   - SUPABASE_BACKGROUND_VIDEO_URL');
    console.log('   - SUPABASE_PETER_IMAGE_URL');
    console.log('   - SUPABASE_STEWIE_IMAGE_URL\n');

    // Test connection
    console.log('🧪 Testing storage connection...');
    const { data: testData, error: testError } = await supabase.storage
      .from('generated-content')
      .list('', { limit: 1 });

    if (testError) {
      console.error('❌ Storage connection test failed:', testError.message);
    } else {
      console.log('✅ Storage connection test successful!');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
setupSupabaseStorage().catch(console.error); 