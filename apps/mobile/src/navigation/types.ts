export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type ResidentStackParamList = {
  Home: undefined;
  MyBookings: undefined;
  ProfessionalList: { category_id: string; category_name: string };
  ProfessionalDetail: { professional_id: string; category_id?: string };
  CreateBooking: {
    professional_id?: string;
    professional_name?: string;
    category_id?: string;
  };
  BookingDetail: { booking_id: string };
  QuotesList: { booking_id: string };
  ReviewScreen: { booking_id: string; professional_name: string };
  ChatScreen: { booking_id: string; other_user_name: string };
};

export type ProfessionalStackParamList = {
  Dashboard:  undefined;
  Jobs:       undefined;
  Profile:    undefined;
  SendQuote:  { booking_id: string };
  JobDetail:  { booking_id: string };
  ChatScreen: { booking_id: string; other_user_name: string };
};

declare global {
  namespace ReactNavigation {
    // Merge both stacks so useNavigation() is typed globally.
    interface RootParamList extends ResidentStackParamList, ProfessionalStackParamList {}
  }
}
