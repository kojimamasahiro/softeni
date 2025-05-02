import { createClient } from 'microcms-js-sdk';

export const client = createClient({
  serviceDomain: process.env.MICROCMS_SERVICE_DOMAIN!,
  apiKey: process.env.MICROCMS_API_KEY!,
});

export const getLiveData = async () => {
  const data = await client.get({ endpoint: 'live' });
  return data;
};
