import nodemailer from 'nodemailer';

import { HOST, USER, PASSWORD, PORT } from '$env/static/private';

const FROM_ADDRESS = 'admin@sunamarketing.com';

function transporter() {
	return nodemailer.createTransport({
		host: HOST, // e.g smtp.gmail.com
		port: PORT, // e.g 465 or 587
		secure: true, // true for 465, false for 587
		auth: {
			user: USER, // sender email
			pass: PASSWORD // sender email password / app password
		},
		authMethod: 'PLAIN'
	});
}

async function send(to: string, subject: string, html: string, text: string) {
	await transporter().sendMail({
		from: `"Support Team" <${FROM_ADDRESS}>`,
		to,
		subject,
		text,
		html,
		envelope: { from: FROM_ADDRESS, to }
	});
}

/**
 * The password reset link.
 *
 * This replaces a function that generated a new password server-side and mailed it in
 * plaintext. That flow had no token and no confirmation: knowing somebody's address was
 * enough to change their password out from under them, and the working credential then sat
 * in an inbox indefinitely. Better Auth issues a single-use token instead, and the person
 * chooses the password themselves.
 *
 * `url` is built from `baseURL`, which is `ORIGIN` — it has to be the origin that actually
 * serves the app, because the running server verifies the token at the end of it.
 */
export async function sendPasswordResetEmail(to: string, url: string, name: string | null) {
	const greeting = name ? `Hello ${name},` : 'Hello,';

	await send(
		to,
		'Reset your password',
		`<h3>Reset your password</h3>
		<p>${greeting}</p>
		<p>Someone asked to reset the password on your account. Choose a new one here:</p>
		<p><a href="${url}">Reset my password</a></p>
		<p>This link can only be used once, and expires in an hour.</p>
		<p>If this was not you, no action is needed — your password has not changed.</p>`,
		`${greeting}\n\nSomeone asked to reset the password on your account. Choose a new one here:\n${url}\n\nThis link can only be used once, and expires in an hour.\nIf this was not you, no action is needed — your password has not changed.`
	);
}
