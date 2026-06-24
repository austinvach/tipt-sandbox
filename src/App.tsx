import { Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";

const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/Home"));
const Theater = lazy(() => import("@/pages/Theater"));
const SdkDemo = lazy(() => import("@/pages/SdkDemo"));
const NewsPaywall = lazy(() => import("@/pages/NewsPaywall"));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
      Loading demo...
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/vod" component={Theater} />
      <Route path="/sdk-demo" component={SdkDemo} />
      <Route path="/news-paywall" component={NewsPaywall} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Suspense fallback={<RouteFallback />}>
        <Router />
      </Suspense>
    </WouterRouter>
  );
}

export default App;
