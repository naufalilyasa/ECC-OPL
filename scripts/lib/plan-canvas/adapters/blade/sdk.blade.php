{{--
  Plan Canvas annotation SDK for Laravel + Inertia (React or Vue).

  Inertia serves the root document through Laravel/Blade, so the Vite plugin's
  transformIndexHtml hook never runs for it. Include this inside <head> of the
  root layout instead:

    @env(['local', 'development'])
      @include('vendor.ecc-plan-canvas.sdk')
    @endenv

  The SDK stays inert unless a Plan Canvas preview session is watching the page,
  so leaving the include in a local-only branch is enough. Remove the block if
  you would rather not keep any adapter in the app at all.
--}}
@env(['local', 'development'])
  <script src="{{ env('ECC_PLAN_CANVAS_URL', 'http://127.0.0.1:4517') }}/sdk.js" defer></script>
@endenv
