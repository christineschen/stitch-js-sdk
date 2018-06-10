import * as EJSON from "mongodb-extjson";
import {
  Anon,
  App,
  AppResponse,
  Http,
  HttpActions,
  HttpRuleCreator,
  Service
} from "stitch-admin";
import { StitchServiceErrorCode, StitchServiceException } from "stitch-core";
import { HttpMethod, HttpRequest } from "stitch-core-services-http";
import { AnonymousCredential } from "stitch-web";
import BaseStitchIntWebTestHarness from "stitch-web-testutils";
import { HttpService } from "../lib/HttpServiceClient";
import HttpServiceClientImpl from "../lib/internal/HttpServiceClientImpl";

const harness = new BaseStitchIntWebTestHarness();

beforeAll(() => harness.setup());
afterAll(() => harness.teardown());

describe("HttpServiceClient", () => {
  it("should execute", async () => {
    const [appResponse, app] = await harness.createApp();
    await harness.addProvider(app as App, new Anon());
    const [svcResponse, svc] = await harness.addService(
      app as App,
      "http",
      new Http("http1")
    );

    await harness.addRule(
      svc as Service,
      new HttpRuleCreator("default", [HttpActions.Delete])
    );

    const client = harness.getAppClient(appResponse as AppResponse);
    await client.auth.loginWithCredential(new AnonymousCredential());

    const httpClient = client.getServiceClientWithName(
      HttpService.Factory,
      "http1"
    );

    // Specifying a request with form and body should fail
    let badUrl = "http:/aol.com";
    const method = HttpMethod.DELETE;
    const body = "hello world!";
    const cookies = {};
    cookies["bob"] = "barker";
    const form = {};
    const headers = {};
    headers["myHeader"] = ["value1", "value2"];

    let badRequest = new HttpRequest.Builder()
      .withUrl(badUrl)
      .withMethod(method)
      .withBody(body)
      .withCookies(cookies)
      .withForm(form)
      .withHeaders(headers)
      .build();

    try {
      await httpClient.execute(badRequest);
      fail();
    } catch (error) {
      expect(error instanceof StitchServiceException).toBeTruthy();
      expect(error.errorCode).toEqual(StitchServiceErrorCode.InvalidParameter);
    }

    // Executing a request against a bad domain should fail
    badUrl = "http://127.0.0.1:234";

    badRequest = new HttpRequest.Builder()
      .withUrl(badUrl)
      .withMethod(method)
      .withBody(body)
      .withCookies(cookies)
      .withHeaders(headers)
      .build();

    try {
      await httpClient.execute(badRequest);
      fail();
    } catch (error) {
      expect(error instanceof StitchServiceException).toBeTruthy();
      expect(error.errorCode).toEqual(StitchServiceErrorCode.HTTPError);
    }

    // A correctly specific request should succeed
    const goodRequest = new HttpRequest.Builder()
      .withUrl("https://httpbin.org/delete")
      .withMethod(method)
      .withBody(body)
      .withCookies(cookies)
      .withHeaders(headers)
      .build();

    const response = await httpClient.execute(goodRequest);

    expect("200 OK").toEqual(response.status);
    expect(200).toEqual(response.statusCode);
    expect(response.contentLength).toBeGreaterThanOrEqual(300);
    expect(response.contentLength).toBeLessThanOrEqual(400);
    expect(response.body).toBeDefined();
    const dataDoc = EJSON.parse(String(response.body!!), { relaxed: true });
    expect(body).toEqual(dataDoc["data"]);
    const headersDoc = dataDoc["headers"];
    expect("value1,value2").toEqual(headersDoc["Myheader"]);
    expect("bob=barker").toEqual(headersDoc["Cookie"]);
  });
});
