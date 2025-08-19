/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import redirects from '../redirects.json';

const cloudEnvs = {
	'Global': 'ww',
	'microsoftonline.us': 'gcc',
	'microsoftonline.mil': 'dod',
	'partner.microsoftonline.cn': 'cn'
}

const redirs = redirects as any;

async function lookupCloud(tenant: string | undefined): Promise<string> {
	// Call the Microsoft federationprovider endpoint to learn the cloud for this tenant
	if (!tenant) return cloudEnvs['Global'];

	const url = new URL('https://odc.officeapps.live.com/odc/v2.1/federationprovider');
	url.searchParams.set('domain', tenant);
	const res = await fetch(url.toString(), { method: 'GET', signal: AbortSignal.timeout(300) });

	if (!res.ok) return cloudEnvs['Global']; // Default to Global if lookup fails

	const data = await res.json() as { environment?: string };
	const envKey = data.environment as keyof typeof cloudEnvs | undefined;
	return envKey ? cloudEnvs[envKey] : cloudEnvs['Global'];
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname.replace(/^\/+/, '');
		if (!path) return Response.redirect('https://github.com/justiniven/nav.ms', 302);

		console.log(url.hostname);

		const domainElements = url.hostname.split('.');
		const pathElements = path.split('/');

		// Determine short, tenant, and cloud from domain and path
		let short: string | undefined;
		let tenant: string | undefined;
		let cloud: string | undefined;

		if (domainElements.length > 2) {
			short = domainElements[0];
			tenant = pathElements[0];
			cloud = pathElements[1];
		} else {
			short = pathElements[0];
			tenant = pathElements[1];
			cloud = pathElements[2];
		}

		// if short is not found redirect to project page
		if (!short) {
			console.log(`No short found in URL: ${url}`);
			return Response.redirect('https://github.com/justiniven/nav.ms?msg=noShortFound', 302);
		}

		// if cloud is not found, look it up
		if (!cloud) {
			console.log(`No cloud found in URL: ${url}`);
			cloud = await lookupCloud(tenant);
			console.log(`Detected cloud for tenant ${tenant}: ${cloud}`);
		}

		// lookup short in 
		let shortObj: any;
		if (redirs['redirects'][short]) {
			shortObj = redirs['redirects'][short];
		} else if (redirs['alias'][short]) {
			shortObj = redirs['redirects'][redirs['alias'][short]];
		} else {
			console.log(`No redirect found for short='${short}'`);
			return Response.redirect('https://github.com/justiniven/nav.ms?msg=noRedirectFound', 302);
		}

		const redirUrls = shortObj[cloud];

		// check if cloud is in redirects
		if (!redirUrls) {
			console.log(`No redirect found for short='${short}', cloud='${cloud}'`);
			return Response.redirect('https://github.com/justiniven/nav.ms?msg=noRedirectForCloud', 302);
		}

		// if tenant is not provided or only one URL exists, redirect to the first URL and ignore the tenant
		if (!tenant || redirUrls.length === 1) {
			return Response.redirect(redirUrls[0], 302);
		} else {
			return Response.redirect(redirUrls[1].replace('{tenant}', encodeURIComponent(tenant)), 302);
		}
	},
} satisfies ExportedHandler<Env>;
