import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Public booking pages are indexable; the admin area and API are not.
        userAgent: '*',
        allow: ['/', '/login'],
        disallow: ['/admin', '/api'],
      },
    ],
    sitemap: 'https://kalyo-v2.vercel.app/sitemap.xml',
  };
}
