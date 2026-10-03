/**
 * Taking payments online through a gateway — everything the routes call. The accounts and their
 * keys are `accounts.ts`; starting a payment, asking about it and recording it, `flow.ts`; asking
 * with nobody signed in and one patient's list, `waiting.ts`.
 */
export { enabledGateways, gatewayAccounts, removeGateway, saveGateway } from './accounts';
export { applyAnswer, askGateway, prepareOnlinePayment, type Applied } from './flow';
export {
	cancelOnlinePayment,
	checkOnlinePayment,
	checkWaiting,
	onNotification,
	patientOnlinePayments,
	textPaymentLink
} from './waiting';
