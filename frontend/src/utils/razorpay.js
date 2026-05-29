let sdkReady = false;

// Appends the Razorpay checkout.js script once; subsequent calls resolve immediately.
export function loadRazorpaySDK() {
  if (sdkReady || window.Razorpay) {
    sdkReady = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload  = () => { sdkReady = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.head.appendChild(script);
  });
}
