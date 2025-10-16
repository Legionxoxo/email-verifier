/**
 * Payment Page
 * Handles payment processing for subscription plans
 */

import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { PaymentForm } from '../components/subscription/PaymentForm';
import { PaymentStatus } from '../components/subscription/PaymentStatus';
import { formatErrorMessage } from '../lib/utils';
import { subscriptionApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { SubscriptionPlan, PaymentFormData, UserSubscription, UpgradeRequest, BillingInfo, ProrationInfo, PollingConfig } from '../types/subscription';

type PaymentState = 'processing' | 'success' | 'failed' | 'pending';

/**
 * Payment page for subscription plans
 * @returns PaymentPage JSX element
 */
export function PaymentPage() {
	try {
		const [searchParams] = useSearchParams();
		const navigate = useNavigate();
		const { user } = useAuth();
		const planId = searchParams.get('planId');
		const statusParam = searchParams.get('status');
		const isRetry = searchParams.get('retry') === 'true';
		const status: PaymentState | null = statusParam && ['processing', 'success', 'failed', 'pending'].includes(statusParam) 
			? statusParam as PaymentState 
			: null;

		// State management
		const [loading, setLoading] = React.useState(false);
		const [error, setError] = React.useState<string>('');
		const [plan, setPlan] = React.useState<SubscriptionPlan | null>(null);
		const [currentSubscription, setCurrentSubscription] = React.useState<UserSubscription | null>(null);
		const [isUpgrade, setIsUpgrade] = React.useState(false);
		const [isDowngrade, setIsDowngrade] = React.useState(false);
		const [paymentState, setPaymentState] = React.useState<PaymentState>(status || 'pending');
		const [paymentData, setPaymentData] = React.useState<{
			paymentId?: string;
			orderId?: string;
			amount?: number;
			errorMessage?: string;
			billing?: BillingInfo;
			proration?: ProrationInfo;
		}>({});

		// Polling state management
		const [isPolling, setIsPolling] = React.useState(false);

		// Refs for cleanup
		const abortControllerRef = React.useRef<AbortController | null>(null);
		const pollingTimeoutRef = React.useRef<number | null>(null);
		const countdownIntervalRef = React.useRef<number | null>(null);
		const handlePaymentErrorRef = React.useRef<((errorMessage: string) => void) | null>(null);

		// Cleanup function for polling
		const cleanupPolling = React.useCallback(() => {
			try {
				if (abortControllerRef.current) {
					abortControllerRef.current.abort();
					abortControllerRef.current = null;
				}
				if (pollingTimeoutRef.current) {
					window.clearTimeout(pollingTimeoutRef.current);
					pollingTimeoutRef.current = null;
				}
				if (countdownIntervalRef.current) {
					window.clearInterval(countdownIntervalRef.current);
					countdownIntervalRef.current = null;
				}
				setIsPolling(false);
			} catch (error) {
				console.error('Error during polling cleanup:', error);
			}
		}, []);

		// Cleanup on unmount
		React.useEffect(() => {
			return () => {
				cleanupPolling();
			};
		}, [cleanupPolling]);

		// Payment status polling function
		const startPaymentStatusPolling = React.useCallback(async (
			subscriptionId: string,
			config: PollingConfig = {
				initialIntervalMs: 2000,
				maxIntervalMs: 30000,
				backoffMultiplier: 1.5,
				maxAttempts: 20,
				timeoutMs: 300000 // 5 minutes
			}
		) => {
			try {
				// Clean up any existing polling
				cleanupPolling();

				setIsPolling(true);
				setPaymentState('processing');

				let attemptCount = 0;
				let currentInterval = config.initialIntervalMs;
				const startTime = Date.now();

				const poll = async (): Promise<void> => {
					try {
						// Check if we should stop polling
						if (attemptCount >= config.maxAttempts) {
							throw new Error('Payment status polling timeout. Please check your payment status manually.');
						}

						if (Date.now() - startTime > config.timeoutMs) {
							throw new Error('Payment verification timeout. Please check your billing history.');
						}

						// Create abort controller for this request
						abortControllerRef.current = new AbortController();
						

						// Make API call
						const statusData = await subscriptionApi.getPaymentStatus(subscriptionId);
						
						// Check if we got aborted
						if (abortControllerRef.current?.signal.aborted) {
							return;
						}

						const { payment, subscription, polling } = statusData;
						
						// Check if we should stop polling
						if (!polling.should_continue) {
							cleanupPolling();
						}
						
						// Handle different payment statuses
						switch (payment.status) {
							case 'completed':
								cleanupPolling();
								setPaymentState('success');
								setPaymentData({
									paymentId: payment.latest_payment_id || undefined,
									orderId: subscription.razorpay_subscription_id,
									amount: subscription.total_amount,
								});
								navigate(`/payment?planId=${planId}&status=success`, { replace: true });
								return;

							case 'failed':
							case 'cancelled':
							case 'expired':
								cleanupPolling();
								if (handlePaymentErrorRef.current) {
									handlePaymentErrorRef.current(payment.message || 'Payment verification failed');
								}
								return;

							case 'not_required':
								// Free plan or immediate processing
								cleanupPolling();
								setPaymentState('success');
								setPaymentData({
									paymentId: 'not-required',
									orderId: 'not-required',
									amount: 0,
								});
								navigate(`/payment?planId=${planId}&status=success`, { replace: true });
								return;

							case 'pending':
								// Continue polling
								attemptCount++;
								
								// Use backend-provided retry interval if available, otherwise use exponential backoff
								const nextInterval = (polling.interval_seconds * 1000) || Math.min(
									currentInterval * config.backoffMultiplier,
									config.maxIntervalMs
								);
								currentInterval = nextInterval;


								// Schedule next poll
								pollingTimeoutRef.current = window.setTimeout(() => {
									if (!abortControllerRef.current?.signal.aborted) {
										poll();
									}
								}, nextInterval);
								
								break;

							default:
								throw new Error(`Unknown payment status: ${payment.status}`);
						}

					} catch (error) {
						// Don't handle aborted requests as errors
						if (abortControllerRef.current?.signal.aborted) {
							return;
						}

						console.error('Payment status polling error:', error);
						
						// If we've exhausted retries or hit a permanent error, stop polling
						if (attemptCount >= config.maxAttempts || 
							(error instanceof Error && error.message.includes('timeout'))) {
							cleanupPolling();
							if (handlePaymentErrorRef.current) {
								handlePaymentErrorRef.current(formatErrorMessage(error));
							}
							return;
						}

						// For temporary errors, continue polling with backoff
						attemptCount++;
						currentInterval = Math.min(currentInterval * config.backoffMultiplier, config.maxIntervalMs);
						
						pollingTimeoutRef.current = window.setTimeout(() => {
							if (!abortControllerRef.current?.signal.aborted) {
								poll();
							}
						}, currentInterval);
					}
				};

				// Start the polling process
				await poll();

			} catch (error) {
				console.error('Failed to start payment status polling:', error);
				cleanupPolling();
				// handlePaymentError will be defined later, so we'll call it via ref
				if (handlePaymentErrorRef.current) {
					handlePaymentErrorRef.current(formatErrorMessage(error));
				}
			}
		}, [cleanupPolling, navigate, planId]);


		// Load plan data and check for existing subscription
		React.useEffect(() => {
			const loadData = async () => {
				if (!planId) {
					setError('No plan selected');
					return;
				}

				try {
					setLoading(true);

					// Load both plans and current subscription in parallel
					const [plans, subscription] = await Promise.all([
						subscriptionApi.getPlans(),
						subscriptionApi.getCurrentSubscription(),
					]);

					// Support both plan codes and legacy plan IDs
					let selectedPlan: SubscriptionPlan | undefined;

					// First try to find by plan_code (if planId is a string like 'free', 'pro', 'plus')
					if (isNaN(Number(planId))) {
						selectedPlan = plans.find(p => p.plan_code === planId);
					} else {
						// Legacy: find by numeric ID
						selectedPlan = plans.find(p => p.id === Number(planId));
					}

					if (!selectedPlan) {
						console.error(
							`Plan not found. Plan ID/Code: ${planId}, Available plans: ${plans
								.map(p => `${p.plan_code}(${p.id})`)
								.join(', ')}`
						);
						setError('Selected plan not found. Please try selecting a plan again.');
						return;
					}

					setPlan(selectedPlan);
					setCurrentSubscription(subscription);

					// Determine if this is an upgrade/downgrade vs new subscription
					// Free plan users should be treated as new subscriptions
					// Only users with active paid subscriptions should use upgrade flow
					const hasActivePaidSubscription =
						subscription && subscription.status === 'active' && subscription.planCode !== 'free'; // Free plan should go through normal flow

					// Check if user is changing to a different plan
					let isDifferentPlan = false;
					if (subscription) {
						// Compare by plan_code first, then fall back to ID comparison
						if (subscription.planCode && selectedPlan.plan_code) {
							isDifferentPlan = subscription.planCode !== selectedPlan.plan_code;
						} else if (subscription.planId !== undefined) {
							isDifferentPlan = subscription.planId !== selectedPlan.id;
						}
					}

					const upgradeScenario = hasActivePaidSubscription && isDifferentPlan;

					// Determine if it's specifically an upgrade or downgrade by comparing prices
					let isUpgradeFlow = false;
					let isDowngradeFlow = false;
					
					if (upgradeScenario && subscription?.plan) {
						const currentPrice = subscription.plan.price || 0;
						const newPrice = selectedPlan.price || 0;
						
						isUpgradeFlow = newPrice > currentPrice;
						isDowngradeFlow = newPrice < currentPrice;
					}

					setIsUpgrade(Boolean(upgradeScenario && isUpgradeFlow));
					setIsDowngrade(Boolean(upgradeScenario && isDowngradeFlow));

					// Note: Billing information will be provided when the upgrade API is called
					// The enhanced backend provides billing details in the upgrade response
				} catch (error) {
					console.error('Failed to load data:', error);
					setError(formatErrorMessage(error));
				} finally {
					setLoading(false);
				}
			};

			loadData();
		}, [planId]);

		const handlePaymentSubmit = async (data: PaymentFormData) => {
			try {
				setPaymentState('processing');

				// For existing paid subscriptions (true upgrades/downgrades), handle immediately without payment processing
				// Free plan users should go through the payment flow, not the upgrade flow
				if ((isUpgrade || isDowngrade) && currentSubscription && currentSubscription.planCode !== 'free') {
					try {
						// Call the upgrade API directly - backend handles subscription changes immediately
						// Support both plan codes and legacy plan IDs
						const upgradeRequest: UpgradeRequest = {};

						if (plan?.plan_code) {
							upgradeRequest.planCode = plan.plan_code;
						} else {
							upgradeRequest.planId = Number(planId);
						}

						const upgradeResponse = await subscriptionApi.updateSubscription(upgradeRequest);

						setPaymentState('success');
						setPaymentData({
							paymentId: 'upgrade-immediate',
							orderId: 'upgrade-immediate',
							amount: upgradeResponse.billing?.chargeAmount || 0,
							billing: upgradeResponse.billing,
							proration: upgradeResponse.proration,
						});

						navigate(`/payment?planId=${planId}&status=success`, { replace: true });
						return;
					} catch (upgradeError) {
						console.error('Upgrade failed:', upgradeError);
						handlePaymentError(formatErrorMessage(upgradeError));
						return;
					}
				}

				// For new subscriptions (not upgrades), create payment intent
				const paymentOrderData = await subscriptionApi.createPaymentIntent(data);

				// Check if it's a free plan or requires payment
				if (!paymentOrderData.requiresPayment) {
					// Free plan activated directly
					setPaymentState('success');
					setPaymentData({
						paymentId: 'free-plan',
						orderId: 'free-plan',
						amount: 0,
					});

					// Update URL to show success status
					navigate(`/payment?planId=${planId}&status=success`, { replace: true });
					return;
				}

				// Check if this is a subscription with a payment URL (new Razorpay subscription workflow)
				// if (paymentOrderData.isSubscription && paymentOrderData.subscriptionUrl) {
				// 	// For Razorpay subscriptions, redirect to subscription payment URL
				// 	window.location.href = paymentOrderData.subscriptionUrl;
				// 	return;
				// }

				// For one-time payments (legacy fallback), open Razorpay checkout
				if (!window.Razorpay) {
					throw new Error('Payment system not loaded. Please refresh and try again.');
				}

				const options = {
					key: paymentOrderData.razorpayKeyId!,
					subscription_id: paymentOrderData.razorpaySubscriptionId,
					amount: paymentOrderData.amount,
					currency: paymentOrderData.currency || 'INR',
					name: 'Subscription Payment',
					description: `${paymentOrderData.planName} Plan`,
					order_id: paymentOrderData.orderId!,
					handler: async (response: any) => {
						try {

							// Start polling for payment status instead of immediate confirmation
							// Use the subscription ID if available, otherwise use payment/order ID
							const pollingId = paymentOrderData.subscriptionId?.toString() || 
											response.razorpay_order_id || 
											response.razorpay_payment_id;
							
							if (pollingId) {
								await startPaymentStatusPolling(pollingId);
							} else {
								// Fallback to immediate confirmation for backward compatibility
								await subscriptionApi.confirmPayment(
									response.razorpay_order_id,
									response.razorpay_payment_id,
									response.razorpay_signature
								);
								handlePaymentSuccess(response.razorpay_payment_id, response.razorpay_order_id);
							}
						} catch (verificationError) {
							console.error('Payment verification error:', verificationError);
							handlePaymentError(formatErrorMessage(verificationError));
						}
					},
					prefill: {
						name: user?.name || 'User',
						email: user?.email || '',
						contact: '',
					},
					theme: {
						color: '#3B82F6',
					},
					modal: {
						ondismiss: () => {
							setPaymentState('pending');
							handlePaymentError('Payment cancelled by user');
						},
					},
				};

				const razorpay = new window.Razorpay(options);
				razorpay.open();
			} catch (error) {
				console.error('Payment submission error:', error);
				setPaymentState('failed');
				setPaymentData({
					errorMessage: formatErrorMessage(error),
				});
				navigate(`/payment?planId=${planId}&status=failed`, { replace: true });
			}
		};

		const handlePaymentSuccess = (paymentId: string, orderId: string) => {
			try {
				setPaymentState('success');
				setPaymentData({
					paymentId,
					orderId,
					amount: plan?.price || 0,
				});

				// Update URL to show success status
				navigate(`/payment?planId=${planId}&status=success`, { replace: true });
			} catch (error) {
				console.error('Payment success handler error:', error);
				handlePaymentError(formatErrorMessage(error));
			}
		};

		const handlePaymentError = React.useCallback((errorMessage: string) => {
			try {
				cleanupPolling();
				setPaymentState('failed');
				setPaymentData({
					errorMessage,
				});
				navigate(`/payment?planId=${planId}&status=failed`, { replace: true });
			} catch (error) {
				console.error('Payment error handler error:', error);
			}
		}, [cleanupPolling, navigate, planId]);

		// Set the ref so polling can use this function
		React.useEffect(() => {
			handlePaymentErrorRef.current = handlePaymentError;
		}, [handlePaymentError]);

		const handleBackToBilling = () => {
			navigate('/billing?view=plans');
		};

		const handleGoToDashboard = () => {
			navigate('/dashboard');
		};

		if (loading) {
			return (
				<div className="min-h-screen flex items-center justify-center bg-gray-50">
					<div className="text-center space-y-4">
						<div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto" />
						<p className="text-gray-600">Loading payment information...</p>
					</div>
				</div>
			);
		}

		if (error || !plan) {
			return (
				<div className="min-h-screen flex items-center justify-center bg-gray-50">
					<div className="max-w-md mx-auto px-4">
						<Card>
							<CardContent className="text-center py-8">
								<AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
								<h2 className="text-lg font-semibold text-gray-900 mb-2">Payment Error</h2>
								<p className="text-sm text-gray-600 mb-4">
									{error || 'Unable to load payment information.'}
								</p>
								<div className="space-y-2">
									<Button onClick={handleBackToBilling} variant="primary" fullWidth>
										Back to Billing
									</Button>
									<Button onClick={handleGoToDashboard} variant="outline" fullWidth>
										Go to Dashboard
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			);
		}

		return (
			<div className="min-h-screen bg-gray-50">
				<div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					{/* Header */}
					<div className="mb-8">
						<div className="flex items-center space-x-4">
							<Button
								variant="ghost"
								size="sm"
								onClick={handleBackToBilling}
								className="flex items-center space-x-1">
								<ArrowLeft className="h-4 w-4" />
								<span>Back to Plans</span>
							</Button>
							<div>
								<h1 className="text-2xl font-bold text-gray-900">
									{paymentState === 'success'
										? 'Payment Successful'
										: paymentState === 'failed'
										? 'Payment Failed'
										: paymentState === 'processing'
										? 'Processing Payment'
										: isRetry
										? 'Complete Your Payment'
										: isUpgrade
										? 'Upgrade Subscription'
										: isDowngrade
										? 'Downgrade Subscription'
										: 'Complete Payment'}
								</h1>
								<p className="text-gray-600 mt-1">
									{paymentState === 'success'
										? isUpgrade
											? 'Your subscription has been upgraded'
											: isDowngrade
											? 'Your subscription has been downgraded'
											: 'Your subscription has been activated'
										: paymentState === 'failed'
										? 'There was an issue processing your payment'
										: paymentState === 'processing'
										? 'Please wait while we process your payment'
										: isRetry
										? `Complete the payment for your ${plan.displayName} subscription`
										: isUpgrade
										? `Upgrade to the ${plan.displayName} plan`
										: isDowngrade
										? `Downgrade to the ${plan.displayName} plan`
										: `Complete your payment for the ${plan.displayName} plan`}
								</p>
							</div>
						</div>
					</div>

					{/* Content */}
					{paymentState === 'success' || paymentState === 'failed' || paymentState === 'processing' ? (
						<PaymentStatus
							status={paymentState}
							plan={plan}
							paymentId={paymentData.paymentId}
							orderId={paymentData.orderId}
							amount={paymentData.amount}
							errorMessage={paymentData.errorMessage}
							isPolling={isPolling}
							onRetryPayment={() => {
								cleanupPolling();
								setPaymentState('pending');
								navigate(`/payment?planId=${planId}`, { replace: true });
							}}
							onGoToDashboard={handleGoToDashboard}
							onGoToBilling={handleBackToBilling}
							onClose={() => {
								cleanupPolling();
								handleBackToBilling();
							}}
						/>
					) : (
						<PaymentForm
							plan={plan}
							currentSubscription={currentSubscription}
							isUpgrade={isUpgrade}
							isDowngrade={isDowngrade}
							onPaymentSubmit={handlePaymentSubmit}
							onPaymentSuccess={handlePaymentSuccess}
							onPaymentError={handlePaymentError}
							loading={(paymentState as PaymentState) === 'processing'}
							billing={paymentData.billing}
							proration={paymentData.proration}
						/>
					)}
				</div>
			</div>
		);
	} catch (error) {
		console.error('PaymentPage render error:', error);
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<Card className="max-w-md">
					<CardContent className="text-center py-8">
						<AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
						<h2 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
						<p className="text-sm text-gray-600 mb-4">
							Unable to load the payment page. Please refresh and try again.
						</p>
						<Button onClick={() => window.location.reload()} variant="primary">
							Refresh Page
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}
}
