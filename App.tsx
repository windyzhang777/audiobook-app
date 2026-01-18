import { createStaticNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BookListScreen } from "@screens/BookListScreen";
import { BookReaderScreen } from "@screens/BookReaderScreen";
import { StatusBar } from "expo-status-bar";
import { ReactElement } from "react";

const RootStack = createNativeStackNavigator({
  initialRouteName: "BookList",
  screens: {
    BookList: BookListScreen,
    BookReader: BookReaderScreen,
  },
});

const Navigation = createStaticNavigation(RootStack);

export default function App(): ReactElement {
  return (
    <>
      <StatusBar style="auto" />
      <Navigation />
    </>
  );
}
