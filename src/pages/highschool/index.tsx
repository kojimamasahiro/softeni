import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function HighschoolIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/highschool/boys');
  }, [router]);

  return null;
}
