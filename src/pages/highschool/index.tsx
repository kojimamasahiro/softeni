import { GetStaticProps } from 'next';

export default function HighschoolIndex() {
  return null;
}

export const getStaticProps: GetStaticProps = async () => {
  return {
    redirect: {
      destination: '/highschool/boys',
      permanent: false,
    },
  };
};
