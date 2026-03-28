export interface GetStartedItem {
  id: string;
  image: any;
  text: string;
}

export const getStartedData: GetStartedItem[] = [
  {
    id: '1',
    image: require('../../public/assets/onboarding-2.jpg'),
    text: 'getStarted.step1',
  },
  {
    id: '2',
    image: require('../../public/assets/onboarding-3.jpg'),
    text: 'getStarted.step2',
  },
  {
    id: '3',
    image: require('../../public/assets/onboarding-4.jpg'),
    text: 'getStarted.step3',
  },
  {
    id: '4',
    image: require('../../public/assets/onboarding-5.jpg'),
    text: 'getStarted.step4',
  },
  {
    id: '5',
    image: require('../../public/assets/onboarding-6.jpg'),
    text: 'getStarted.step5',
  },
];
