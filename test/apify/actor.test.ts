import { ACT_JOB_STATUSES, ENV_VARS, KEY_VALUE_STORE_KEYS, WEBHOOK_EVENT_TYPES } from '@apify/consts';
import log from '@apify/log';
import { Actor, ApifyEnv, ProxyConfiguration } from 'apify';
import { ActorClient, ApifyClient, RunClient, TaskClient, WebhookUpdateData } from 'apify-client';
import { Configuration, EventType, Dataset, KeyValueStore, RequestList, StorageManager } from '@crawlee/core';
import { sleep } from '@crawlee/utils';
import { StorageTestCases } from '../shared/test-cases';

const getEmptyEnv = () => {
    return {
        // internalPort: null,
        actorId: null,
        actorRunId: null,
        userId: null,
        token: null,
        startedAt: null,
        timeoutAt: null,
        defaultKeyValueStoreId: null,
        defaultDatasetId: null,
        memoryMbytes: null,
    } as ApifyEnv;
};

const setEnv = (env: ApifyEnv) => {
    delete process.env.APIFY_ACTOR_ID;
    delete process.env.APIFY_ACTOR_RUN_ID;
    delete process.env.APIFY_USER_ID;
    delete process.env.APIFY_TOKEN;
    delete process.env.APIFY_STARTED_AT;
    delete process.env.APIFY_TIMEOUT_AT;
    delete process.env.APIFY_DEFAULT_KEY_VALUE_STORE_ID;
    delete process.env.APIFY_DEFAULT_DATASET_ID;
    delete process.env.APIFY_MEMORY_MBYTES;

    if (env.actorId) process.env.APIFY_ACTOR_ID = env.actorId;
    if (env.actorRunId) process.env.APIFY_ACTOR_RUN_ID = env.actorRunId;
    if (env.userId) process.env.APIFY_USER_ID = env.userId;
    if (env.token) process.env.APIFY_TOKEN = env.token;
    if (env.startedAt) process.env.APIFY_STARTED_AT = env.startedAt.toISOString();
    if (env.timeoutAt) process.env.APIFY_TIMEOUT_AT = env.timeoutAt.toISOString();
    if (env.defaultKeyValueStoreId) process.env.APIFY_DEFAULT_KEY_VALUE_STORE_ID = env.defaultKeyValueStoreId;
    if (env.defaultDatasetId) process.env.APIFY_DEFAULT_DATASET_ID = env.defaultDatasetId;
    if (env.memoryMbytes) process.env.APIFY_MEMORY_MBYTES = env.memoryMbytes.toString();
};

describe.each(StorageTestCases)('Actor - %s', (Emulator) => {
    const localStorageEmulator = new Emulator();

    beforeEach(async () => {
        await localStorageEmulator.init();
    });

    afterEach(() => jest.restoreAllMocks());

    afterAll(async () => {
        await localStorageEmulator.destroy();
    });

    describe('new Actor({ ... })', () => {
        describe('getEnv()', () => {
            let prevEnv: ApifyEnv;

            beforeAll(() => { prevEnv = new Actor().getEnv(); });
            afterAll(() => { setEnv(prevEnv); });

            test('works with null values', () => {
                const expectedEnv = getEmptyEnv();
                setEnv(expectedEnv);

                const env = new Actor().getEnv();
                expect(env).toMatchObject(expectedEnv);
            });

            test('works with with non-null values', () => {
                const expectedEnv = {
                    ...getEmptyEnv(),
                    // internalPort: 12345,
                    actorId: 'test actId',
                    actorRunId: 'test actId',
                    userId: 'some user',
                    token: 'auth token',
                    startedAt: new Date('2017-01-01'),
                    timeoutAt: new Date(),
                    defaultKeyValueStoreId: 'some store',
                    defaultDatasetId: 'some dataset',
                    memoryMbytes: 1234,
                };
                setEnv(expectedEnv);

                const env = new Actor().getEnv();
                expect(env).toMatchObject(expectedEnv);
            });
        });

        describe('main()', () => {
            test('throws on invalid args', () => {
                // @ts-expect-error invalid options
                expect(() => new Actor().main()).toThrow();
            });

            test('works with simple user function', async () => {
                await expect(new Actor().main(() => {}, { exit: false })).resolves.not.toThrow();
            });

            test.skip('respects `localStorageEnableWalMode` option (gh issue #956)', async () => {
            // FIXME this should be handled via storage options
            // delete process.env[ENV_VARS.LOCAL_STORAGE_DIR];
            // delete process.env[ENV_VARS.TOKEN];
            //
            // const sdk1 = new Actor();
            // const sessionPool1 = await sdk1.openSessionPool();
            // expect(sessionPool1).toBeInstanceOf(SessionPool);
            // const storage1 = sdk1.config.getStorageLocal();
            // expect(storage1.enableWalMode).toBe(true);
            //
            // const sdk2 = new Actor({ localStorageEnableWalMode: false });
            // const sessionPool2 = await sdk2.openSessionPool();
            // expect(sessionPool2).toBeInstanceOf(SessionPool);
            // const storage2 = sdk2.config.getStorageLocal();
            // expect(storage2.enableWalMode).toBe(false);
            //
            // delete process.env[ENV_VARS.LOCAL_STORAGE_DIR];
            });

            test('works with promised user function', async () => {
                let called = false;
                await Actor.main(async () => {
                    await sleep(20);
                    called = true;
                }, { exit: false });
                expect(called).toBe(true);
            });

            test('on exception in simple user function the process exits with code 91', async () => {
                const exitSpy = jest.spyOn(process, 'exit');
                exitSpy.mockImplementation();
                await Actor.main(async () => {
                    throw new Error('Test exception I');
                });
                expect(exitSpy).toBeCalledWith(91);
            });

            test('on exception in promised user function the process exits with code 91', async () => {
                const exitSpy = jest.spyOn(process, 'exit');
                exitSpy.mockImplementation();
                await Actor.main(async () => {
                    await sleep(20);
                    throw new Error('Test exception I');
                });
                expect(exitSpy).toBeCalledWith(91);
            });
        });

        // TODO just test we call the client method via jest spy and use the token if available
        describe.skip('call()', () => {
            const token = 'some-token';
            const actId = 'some-act-id';
            const defaultKeyValueStoreId = 'some-store-id';
            const input = 'something';
            const contentType = 'text/plain';
            const outputKey = 'OUTPUT';
            const outputValue = 'some-output';
            const build = 'xxx';

            const run = { id: 'some-run-id', actId, defaultKeyValueStoreId };
            const finishedRun = { ...run, status: ACT_JOB_STATUSES.SUCCEEDED };
            const failedRun = { ...run, status: ACT_JOB_STATUSES.ABORTED };
            const runningRun = { ...run, status: ACT_JOB_STATUSES.RUNNING };
            const readyRun = { ...run, status: ACT_JOB_STATUSES.READY };

            const output = { contentType, key: outputKey, value: outputValue };
            const expected = { ...finishedRun, output: { contentType, body: outputValue } };

            test('works as expected', async () => {
                const memory = 1024;
                const timeout = 60;
                const webhooks = [{ a: 'a' }, { b: 'b' }] as unknown as WebhookUpdateData[];

                const getRecordMock = jest.fn();
                getRecordMock.mockResolvedValueOnce(output);
                const callMock = jest.fn();
                callMock.mockResolvedValueOnce(finishedRun);
                const actorSpy = jest.spyOn(ApifyClient.prototype, 'actor');
                actorSpy.mockReturnValueOnce({ call: callMock } as any);
                const keyValueStoreSpy = jest.spyOn(ApifyClient.prototype, 'keyValueStore');
                keyValueStoreSpy.mockReturnValueOnce({ getRecord: getRecordMock } as any);

                const callOutput = await new Actor().call(actId, input, {
                    contentType,
                    build,
                    memory,
                    timeout,
                    webhooks,
                });

                expect(callOutput).toEqual(expected);
                expect(keyValueStoreSpy).toBeCalledTimes(1);
                expect(keyValueStoreSpy).toBeCalledWith('some-store-id');
            });

            test('works as expected with fetchOutput = false', async () => {
                const callMock = jest.fn();
                callMock.mockResolvedValueOnce(finishedRun);
                const actorSpy = jest.spyOn(ApifyClient.prototype, 'actor');
                const keyValueStoreSpy = jest.spyOn(ApifyClient.prototype, 'keyValueStore');
                actorSpy.mockReturnValueOnce({ call: callMock } as any);

                const callOutput = await new Actor().call(actId);

                expect(keyValueStoreSpy).not.toBeCalled();
                expect(callOutput).toEqual(finishedRun);
            });

            test('works with token', async () => {
                const memory = 1024;
                const timeout = 60;
                const webhooks = [{ a: 'a' }, { b: 'b' }] as any;

                const newClientSpy = jest.spyOn(Actor.prototype, 'newClient');
                const callMock = jest.fn();
                callMock.mockResolvedValueOnce(finishedRun);
                const getRecordMock = jest.fn();
                getRecordMock.mockResolvedValueOnce(output);
                const actorSpy = jest.spyOn(ApifyClient.prototype, 'actor');
                actorSpy.mockReturnValueOnce({ call: callMock } as any);
                const keyValueStoreSpy = jest.spyOn(ApifyClient.prototype, 'keyValueStore');
                keyValueStoreSpy.mockReturnValueOnce({ getRecord: getRecordMock } as any);

                const callOutput = await new Actor({ storageClientOptions: { token } }).call(actId, input, {
                    contentType,
                    build,
                    memory,
                    timeout,
                    webhooks,
                });

                expect(callOutput).toEqual(expected);
                expect(newClientSpy).toBeCalledWith({ token });
                expect(actorSpy).toBeCalledWith(actId);
                expect(callMock).toBeCalledWith(input, {
                    token,
                    build,
                    contentType: `${contentType}; charset=utf-8`,
                    memory,
                    timeout,
                    webhooks,
                });
                expect(keyValueStoreSpy).toBeCalledWith(run.defaultKeyValueStoreId);
                expect(getRecordMock).toBeCalledWith('OUTPUT', { buffer: true });
            });

            test('works as expected with unfinished run', async () => {
                const waitForFinish = 1;

                const callMock = jest.fn();
                callMock.mockResolvedValueOnce(runningRun);
                const actorSpy = jest.spyOn(ApifyClient.prototype, 'actor');
                actorSpy.mockReturnValueOnce({ call: callMock } as any);
                const keyValueStoreSpy = jest.spyOn(ApifyClient.prototype, 'keyValueStore');

                const callOutput = await new Actor().call(actId, undefined, { waitForFinish });

                expect(callOutput).toEqual(runningRun);
                expect(actorSpy).toBeCalledWith('some-act-id');
                expect(keyValueStoreSpy).not.toBeCalled();
            });

            test('returns immediately with zero ', async () => {
                const waitForFinish = 0;

                const callMock = jest.fn();
                callMock.mockResolvedValueOnce(readyRun);
                const actorSpy = jest.spyOn(ApifyClient.prototype, 'actor');
                actorSpy.mockReturnValueOnce({ call: callMock } as any);
                const keyValueStoreSpy = jest.spyOn(ApifyClient.prototype, 'keyValueStore');

                const callOutput = await new Actor().call(actId, undefined, { waitForFinish });

                expect(callOutput).toEqual(readyRun);
                expect(actorSpy).toBeCalledWith('some-act-id');
                expect(keyValueStoreSpy).not.toBeCalled();
            });

            test("throws if run doesn't succeed", async () => {
                const callMock = jest.fn();
                callMock.mockResolvedValueOnce(failedRun);
                const actorSpy = jest.spyOn(ApifyClient.prototype, 'actor');
                actorSpy.mockReturnValueOnce({ call: callMock } as any);

                expect(actorSpy).toBeCalledWith('some-act-id');
            });
        });

        // TODO just test we call the client method via jest spy and use the token if available
        describe.skip('callTask()', () => {
            const taskId = 'some-task-id';
            const actId = 'xxx';
            const token = 'some-token';
            const defaultKeyValueStoreId = 'some-store-id';
            const run = { id: 'some-run-id', actId, defaultKeyValueStoreId };
            const readyRun = { ...run, status: ACT_JOB_STATUSES.READY };
            const runningRun = { ...run, status: ACT_JOB_STATUSES.RUNNING };
            const finishedRun = { ...run, status: ACT_JOB_STATUSES.SUCCEEDED };
            const failedRun = { ...run, status: ACT_JOB_STATUSES.ABORTED };
            const contentType = 'application/json';
            const outputKey = 'OUTPUT';
            const outputValue = 'some-output';
            const output = { contentType, key: outputKey, value: outputValue };
            const expected = { ...finishedRun, output: { contentType, body: outputValue } };
            const input = { foo: 'bar' };
            const memory = 256;
            const timeout = 60;
            const build = 'beta';
            const webhooks = [{ a: 'a' }, { b: 'b' }] as any;

            test('works as expected', async () => {
                const getRecordMock = jest.fn();
                getRecordMock.mockResolvedValueOnce(output);
                const callMock = jest.fn();
                callMock.mockResolvedValueOnce(finishedRun);
                const taskSpy = jest.spyOn(ApifyClient.prototype, 'task');
                taskSpy.mockReturnValueOnce({ call: callMock } as any);
                const keyValueStoreSpy = jest.spyOn(ApifyClient.prototype, 'keyValueStore');
                keyValueStoreSpy.mockReturnValueOnce({ getRecord: getRecordMock } as any);

                const callOutput = await new Actor().callTask(taskId, input, { memory, timeout, build, webhooks });

                expect(callOutput).toEqual(expected);
                expect(taskSpy).toBeCalledWith('some-task-id');
            });

            test('works with token', async () => {
                const newClientSpy = jest.spyOn(Actor.prototype, 'newClient');
                const callMock = jest.fn();
                callMock.mockResolvedValueOnce(finishedRun);
                const getRecordMock = jest.fn();
                getRecordMock.mockResolvedValueOnce(output);
                const taskSpy = jest.spyOn(ApifyClient.prototype, 'task');
                taskSpy.mockReturnValueOnce({ call: callMock } as any);
                const keyValueStoreSpy = jest.spyOn(ApifyClient.prototype, 'keyValueStore');
                keyValueStoreSpy.mockReturnValueOnce({ getRecord: getRecordMock } as any);

                const callOutput = await new Actor({ storageClientOptions: { token } }).callTask(taskId, input, {
                    build,
                    memory,
                    timeout,
                    webhooks,
                });

                expect(callOutput).toEqual(expected);
                expect(newClientSpy).toBeCalledWith({ token });
                expect(taskSpy).toBeCalledWith(taskId);
                expect(callMock).toBeCalledWith(input, {
                    token,
                    build,
                    memory,
                    timeout,
                    webhooks,
                });
                expect(keyValueStoreSpy).toBeCalledWith(run.defaultKeyValueStoreId);
                expect(getRecordMock).toBeCalledWith('OUTPUT', { buffer: true });
            });

            test('works as expected with fetchOutput = false', async () => {
                const callMock = jest.fn();
                callMock.mockResolvedValueOnce(finishedRun);
                const taskSpy = jest.spyOn(ApifyClient.prototype, 'task');
                const keyValueStoreSpy = jest.spyOn(ApifyClient.prototype, 'keyValueStore');
                taskSpy.mockReturnValueOnce({ call: callMock } as any);

                const callOutput = await new Actor().callTask(taskId, undefined, {});

                expect(keyValueStoreSpy).not.toBeCalled();
                expect(callOutput).toEqual(finishedRun);
                expect(taskSpy).toBeCalledWith('some-task-id');
            });

            test('works as expected with unfinished run', async () => {
                const waitForFinish = 1;

                const callMock = jest.fn();
                callMock.mockResolvedValueOnce(runningRun);
                const taskSpy = jest.spyOn(ApifyClient.prototype, 'task');
                taskSpy.mockReturnValueOnce({ call: callMock } as any);
                const keyValueStoreSpy = jest.spyOn(ApifyClient.prototype, 'keyValueStore');

                const callOutput = await new Actor().callTask(taskId, undefined, { waitForFinish });

                expect(callOutput).toEqual(runningRun);
                expect(keyValueStoreSpy).not.toBeCalled();
                expect(taskSpy).toBeCalledWith('some-task-id');
            });

            test('returns immediately with zero ', async () => {
                const waitForFinish = 0;

                const callMock = jest.fn();
                callMock.mockResolvedValueOnce(readyRun);
                const taskSpy = jest.spyOn(ApifyClient.prototype, 'task');
                taskSpy.mockReturnValueOnce({ call: callMock } as any);
                const keyValueStoreSpy = jest.spyOn(ApifyClient.prototype, 'keyValueStore');

                const callOutput = await new Actor().callTask(taskId, undefined, { waitForFinish });

                expect(callOutput).toEqual(readyRun);
                expect(keyValueStoreSpy).not.toBeCalled();
                expect(taskSpy).toBeCalledWith('some-task-id');
            });

            test("throws if run doesn't succeed", async () => {
                const callMock = jest.fn();
                callMock.mockResolvedValueOnce(failedRun);
                const taskSpy = jest.spyOn(ApifyClient.prototype, 'task');
                taskSpy.mockReturnValueOnce({ call: callMock } as any);

                expect(taskSpy).toBeCalledWith('some-task-id');
            });
        });

        // TODO just test we call the client method via jest spy and use the token if available
        describe.skip('metamorph()', () => {
            const runId = 'some-run-id';
            const actorId = 'some-actor-id';
            const targetActorId = 'some-target-actor-id';
            const contentType = 'application/json';
            const input = '{ "foo": "bar" }';
            const build = 'beta';
            const run = { id: runId, actorId };

            beforeEach(() => {
                process.env[ENV_VARS.ACTOR_ID] = actorId;
                process.env[ENV_VARS.ACTOR_RUN_ID] = runId;
            });

            afterEach(() => {
                delete process.env[ENV_VARS.ACTOR_ID];
                delete process.env[ENV_VARS.ACTOR_RUN_ID];
            });

            test('works as expected', async () => {
                const metamorphMock = jest.fn();
                metamorphMock.mockResolvedValueOnce(run);
                const runSpy = jest.spyOn(ApifyClient.prototype, 'run');
                runSpy.mockReturnValueOnce({ metamorph: metamorphMock } as any);

                await new Actor().metamorph(targetActorId, input, { contentType, build, customAfterSleepMillis: 1 });

                expect(metamorphMock).toBeCalledWith(targetActorId, input, {
                    build,
                    contentType: `${contentType}; charset=utf-8`,
                });
            });

            test('works without opts and input', async () => {
                const metamorphMock = jest.fn();
                metamorphMock.mockResolvedValueOnce(run);
                const runSpy = jest.spyOn(ApifyClient.prototype, 'run');
                runSpy.mockReturnValueOnce({ metamorph: metamorphMock } as any);

                await new Actor().metamorph(targetActorId, undefined, { customAfterSleepMillis: 1 });

                expect(metamorphMock).toBeCalledWith(targetActorId, undefined, {});
            });
        });

        describe('addWebhook()', () => {
            const runId = 'my-run-id';
            const expectedEventTypes = [WEBHOOK_EVENT_TYPES.ACTOR_RUN_SUCCEEDED];
            const expectedRequestUrl = 'http://example.com/api';
            const expectedPayloadTemplate = '{"hello":{{world}}';
            const expectedIdempotencyKey = 'some-key';
            const webhook = {
                isAdHoc: true,
                eventTypes: expectedEventTypes,
                condition: {
                    actorRunId: runId,
                },
                requestUrl: expectedRequestUrl,
                payloadTemplate: expectedPayloadTemplate,
                idempotencyKey: expectedIdempotencyKey,
            };

            test('works', async () => {
                process.env[ENV_VARS.ACTOR_RUN_ID] = runId;
                process.env[ENV_VARS.IS_AT_HOME] = '1';

                const createMock = jest.fn();
                createMock.mockResolvedValueOnce(webhook);
                const webhooksSpy = jest.spyOn(ApifyClient.prototype, 'webhooks');
                webhooksSpy.mockReturnValueOnce({ create: createMock } as any);

                await new Actor().addWebhook({
                    eventTypes: expectedEventTypes,
                    requestUrl: expectedRequestUrl,
                    payloadTemplate: expectedPayloadTemplate,
                    idempotencyKey: expectedIdempotencyKey,
                });

                delete process.env[ENV_VARS.ACTOR_RUN_ID];
                delete process.env[ENV_VARS.IS_AT_HOME];

                expect(webhooksSpy).toBeCalledTimes(1);
            });

            test('on local logs warning and does nothing', async () => {
                const warningMock = jest.spyOn(log, 'warning');
                const metamorphMock = jest.fn();
                const runSpy = jest.spyOn(RunClient.prototype, 'metamorph');
                runSpy.mockImplementationOnce(metamorphMock);

                const sdk = new Actor();
                await sdk.addWebhook({ eventTypes: expectedEventTypes, requestUrl: expectedRequestUrl });

                expect(metamorphMock).not.toBeCalled();
                expect(warningMock).toBeCalledWith('Actor.addWebhook() is only supported when running on the Apify platform. The webhook will not be invoked.');
                warningMock.mockRestore();
            });

            test('should fail without actor run ID', async () => {
                process.env[ENV_VARS.IS_AT_HOME] = '1';

                let isThrow;
                try {
                    await new Actor().addWebhook({ eventTypes: expectedEventTypes, requestUrl: expectedRequestUrl });
                } catch (err) {
                    isThrow = true;
                }
                expect(isThrow).toBe(true);

                delete process.env[ENV_VARS.IS_AT_HOME];
            });

            test('Actor.createProxyConfiguration() allows useApifyProxy option', async () => {
                const proxyConfiguration = {
                    useApifyProxy: true,
                    apifyProxyGroups: [
                        'RESIDENTIAL',
                    ],
                    apifyProxyCountry: 'US',
                };

                const initializeSpy = jest.spyOn(ProxyConfiguration.prototype, 'initialize');
                initializeSpy.mockImplementationOnce(async () => {});
                await expect(Actor.createProxyConfiguration(proxyConfiguration)).resolves.toBeInstanceOf(ProxyConfiguration);
                expect(initializeSpy).toBeCalledTimes(1);
            });

            test('createProxyConfiguration should create ProxyConfiguration', async () => {
                const sdk = new Actor();
                const initializeSpy = jest.spyOn(ProxyConfiguration.prototype, 'initialize');
                initializeSpy.mockImplementationOnce(async () => {});
                await sdk.createProxyConfiguration();
                expect(initializeSpy).toBeCalledTimes(1);
            });
        });

        describe('Storage API', () => {
            let sdk: Actor;

            beforeEach(async () => { sdk = new Actor({ storageClientOptions: { storageDir: await localStorageEmulator.init() } }); });
            afterAll(() => localStorageEmulator.destroy());

            test('getInput()', async () => {
                const getValueSpy = jest.spyOn(KeyValueStore.prototype, 'getValue');
                getValueSpy.mockImplementation(async () => 123);

                // Uses default value.
                const val1 = await sdk.getInput();
                expect(getValueSpy).toBeCalledTimes(1);
                expect(getValueSpy).toBeCalledWith(KEY_VALUE_STORE_KEYS.INPUT);
                expect(val1).toBe(123);

                // Uses value from config
                sdk.config.set('inputKey', 'some-value');
                const val2 = await sdk.getInput();
                expect(getValueSpy).toBeCalledTimes(2);
                expect(getValueSpy).toBeCalledWith('some-value');
                expect(val2).toBe(123);
                sdk.config.set('inputKey', undefined); // restore defaults
            });

            test('setValue()', async () => {
                const record = { foo: 'bar' };
                const setValueSpy = jest.spyOn(KeyValueStore.prototype, 'setValue');
                setValueSpy.mockImplementationOnce(async () => {});

                await sdk.setValue('key-1', record);
                expect(setValueSpy).toBeCalledTimes(1);
                expect(setValueSpy).toBeCalledWith('key-1', record, {});
            });

            test('getValue()', async () => {
                const getValueSpy = jest.spyOn(KeyValueStore.prototype, 'getValue');
                getValueSpy.mockImplementationOnce(async () => 123);

                const val = await sdk.getValue('key-1');
                expect(getValueSpy).toBeCalledTimes(1);
                expect(getValueSpy).toBeCalledWith('key-1');
                expect(val).toBe(123);
            });

            test('pushData()', async () => {
                const pushDataSpy = jest.spyOn(Dataset.prototype, 'pushData');
                pushDataSpy.mockImplementationOnce(async () => {});

                await sdk.pushData({ foo: 'bar' });
                expect(pushDataSpy).toBeCalledTimes(1);
                expect(pushDataSpy).toBeCalledWith({ foo: 'bar' });
            });

            test('openRequestList should create RequestList', async () => {
                const initializeSpy = jest.spyOn(RequestList.prototype, 'initialize');
                initializeSpy.mockImplementationOnce(async () => {});
                const list = await sdk.openRequestList('my-list', ['url-1', 'url-2', 'url-3']);
                expect(initializeSpy).toBeCalledTimes(1);
                // @ts-expect-error Private property
                expect(list.sources).toEqual(['url-1', 'url-2', 'url-3']);
                // @ts-expect-error Private property
                expect(list.persistStateKey).toBe('SDK_my-list-REQUEST_LIST_STATE');
                // @ts-expect-error Private property
                expect(list.persistRequestsKey).toBe('SDK_my-list-REQUEST_LIST_REQUESTS');
            });

            test('openRequestQueue should open storage', async () => {
                const queueId = 'abc';
                const options = { forceCloud: true };
                const openStorageSpy = jest.spyOn(StorageManager.prototype, 'openStorage');
                openStorageSpy.mockImplementationOnce(async (i) => i);
                await sdk.openRequestQueue(queueId, options);
                expect(openStorageSpy).toBeCalledWith(queueId, sdk.apifyClient);
                expect(openStorageSpy).toBeCalledTimes(1);
            });

            test('openDataset should open storage', async () => {
                const datasetName = 'abc';
                const options = { forceCloud: true };
                const mockOpenStorage = jest.spyOn(StorageManager.prototype, 'openStorage');
                mockOpenStorage.mockResolvedValueOnce(jest.fn());
                await sdk.openDataset(datasetName, options);
                expect(mockOpenStorage).toBeCalledTimes(1);
                expect(mockOpenStorage).toBeCalledWith(datasetName, sdk.apifyClient);
            });
        });
    });

    const globalOptions = {
        token: 'some-token',
        actId: 'some-act-id',
        defaultKeyValueStoreId: 'some-store-id',
        input: { foo: 'bar' },
        contentType: 'application/json',
        outputKey: 'OUTPUT',
        outputValue: 'some-output',
        build: 'xxx',
        taskId: 'some-task-id',
        runId: 'some-run-id',
        targetActorId: 'some-target-actor-id',
    };

    const runKeys = ['run', 'output', 'finishedRun', 'failedRun', 'runningRun', 'readyRun', 'expected'] as const;

    // @ts-expect-error
    const runConfigs : Record<typeof runKeys[number], any> = {
        run: { id: globalOptions.runId, actId: globalOptions.actId, defaultKeyValueStoreId: globalOptions.defaultKeyValueStoreId },
        output: { contentType: globalOptions.contentType, key: globalOptions.outputKey, value: globalOptions.outputValue },
        init() {
        // @ts-expect-error
            this.finishedRun = { ...this.run, status: ACT_JOB_STATUSES.SUCCEEDED };
            // @ts-expect-error
            this.failedRun = { ...this.run, status: ACT_JOB_STATUSES.ABORTED };
            // @ts-expect-error
            this.runningRun = { ...this.run, status: ACT_JOB_STATUSES.RUNNING };
            // @ts-expect-error
            this.readyRun = { ...this.run, status: ACT_JOB_STATUSES.READY };
            // @ts-expect-error
            this.expected = { ...this.finishedRun, output: { contentType: globalOptions.contentType, body: globalOptions.outputValue } };
            return this;
        },
    }.init();

    describe('Actor.getEnv()', () => {
        let prevEnv: ApifyEnv;

        beforeAll(() => {
            prevEnv = Actor.getEnv();
        });

        afterAll(() => {
            setEnv(prevEnv);
        });

        test('works with null values', () => {
            const expectedEnv = getEmptyEnv();
            setEnv(expectedEnv);

            const env = Actor.getEnv();
            expect(env).toMatchObject(expectedEnv);
        });

        test('works with with non-null values', () => {
            const expectedEnv = {
                ...getEmptyEnv(),
                ...{
                    // internalPort: 12345,
                    actorId: 'test actId',
                    actorRunId: 'test actId',
                    userId: 'some user',
                    token: 'auth token',
                    startedAt: new Date('2017-01-01'),
                    timeoutAt: new Date(),
                    defaultKeyValueStoreId: 'some store',
                    defaultDatasetId: 'some dataset',
                    memoryMbytes: 1234,
                } };
            setEnv(expectedEnv);

            const env = Actor.getEnv();
            expect(env).toMatchObject(expectedEnv);
        });
    });

    // TODO we should remove the duplication if possible
    describe('Actor.call()', () => {
        const { contentType, build, actId, input, token } = globalOptions;

        test('works as expected', async () => {
            const memory = 1024;
            const timeout = 60;
            const webhooks = [{ a: 'a' }, { b: 'b' }] as unknown as WebhookUpdateData[];

            const options = { contentType, build, memory, timeout, webhooks };

            const actorSpy = jest.spyOn(ApifyClient.prototype, 'actor');
            const callSpy = jest.spyOn(ActorClient.prototype, 'call').mockReturnValue(runConfigs.finishedRun);
            await Actor.call(actId, input, options);

            expect(actorSpy).toBeCalledWith(actId);
            expect(callSpy).toBeCalledWith(input, options);
        });

        test('works with token', async () => {
            const memory = 1024;
            const timeout = 60;
            const webhooks = [{ a: 'a' }, { b: 'b' }] as unknown as WebhookUpdateData[];

            const newClientSpy = jest.spyOn(Actor.prototype, 'newClient');
            const actorSpy = jest.spyOn(ApifyClient.prototype, 'actor');
            const callSpy = jest.spyOn(ActorClient.prototype, 'call').mockReturnValue(runConfigs.finishedRun);
            await Actor.call(actId, input, { contentType, build, token, memory, timeout, webhooks });

            expect(newClientSpy).toBeCalledWith({ token });
            expect(actorSpy).toBeCalledWith(actId);
            expect(callSpy).toBeCalledWith(input, {
                build,
                contentType,
                memory,
                timeout,
                webhooks,
            });
        });
    });

    // TODO we should remove the duplication if possible
    describe('Actor.callTask()', () => {
        const memory = 256; // m
        const timeout = 60; // se
        const webhooks = [{ a: 'a' }, { b: 'b' }] as unknown as WebhookUpdateData[];

        const { input, taskId, token, build } = globalOptions;
        const { finishedRun } = runConfigs;

        test('works as expected', async () => {
            const taskSpy = jest.spyOn(ApifyClient.prototype, 'task');
            const callSpy = jest.spyOn(TaskClient.prototype, 'call').mockReturnValue(finishedRun);

            const options = { memory, timeout, build, webhooks };
            const callOutput = await Actor.callTask(taskId, input, options);

            expect(callOutput).toEqual(finishedRun);

            expect(taskSpy).toBeCalledTimes(1);
            expect(taskSpy).toBeCalledWith(taskId);

            expect(callSpy).toBeCalledTimes(1);
            expect(callSpy).toBeCalledWith(input, options);
        });

        test('works with token', async () => {
            const options = { memory, timeout, build, webhooks };

            const newClientSpy = jest.spyOn(Actor.prototype, 'newClient');
            const taskSpy = jest.spyOn(ApifyClient.prototype, 'task');
            const callSpy = jest.spyOn(TaskClient.prototype, 'call').mockReturnValue(finishedRun);
            const callOutput = await Actor.callTask(taskId, input, { token, ...options });

            expect(newClientSpy).toBeCalledWith({ token });
            expect(taskSpy).toBeCalledWith(taskId);
            expect(callSpy).toBeCalledWith(input, options);

            expect(callOutput).toEqual(finishedRun);
        });
    });

    // TODO we should remove the duplication if possible
    describe('Actor.metamorph()', () => {
        const { actId, runId, targetActorId, input, contentType, build } = globalOptions;

        const { run } = runConfigs;

        beforeEach(() => {
            process.env[ENV_VARS.ACTOR_ID] = actId;
            process.env[ENV_VARS.ACTOR_RUN_ID] = runId;
            process.env[ENV_VARS.IS_AT_HOME] = '1';
        });

        afterEach(() => {
            delete process.env[ENV_VARS.ACTOR_ID];
            delete process.env[ENV_VARS.ACTOR_RUN_ID];
            delete process.env[ENV_VARS.IS_AT_HOME];
            jest.restoreAllMocks();
        });

        test('works as expected', async () => {
            const metamorphMock = jest.fn();
            metamorphMock.mockResolvedValueOnce(run);

            const runSpy = jest.spyOn(ApifyClient.prototype, 'run');
            runSpy.mockReturnValueOnce({ metamorph: metamorphMock } as any);

            await Actor.metamorph(targetActorId, input, { contentType, build, customAfterSleepMillis: 1 });

            expect(runSpy).toBeCalledTimes(1);

            expect(metamorphMock).toBeCalledWith(targetActorId, input, {
                build,
                contentType,
            });
        });

        test('works without opts and input', async () => {
            const metamorphMock = jest.fn();
            metamorphMock.mockResolvedValueOnce(run);
            const runSpy = jest.spyOn(ApifyClient.prototype, 'run');
            runSpy.mockReturnValueOnce({ metamorph: metamorphMock } as any);

            await Actor.metamorph(targetActorId, undefined, { customAfterSleepMillis: 1 });

            expect(metamorphMock).toBeCalledWith(targetActorId, undefined, {});
        });
    });

    describe('Actor.reboot()', () => {
        const { actId, runId } = globalOptions;

        beforeEach(() => {
            process.env[ENV_VARS.IS_AT_HOME] = '1';
            process.env[ENV_VARS.ACTOR_ID] = actId;
            process.env[ENV_VARS.ACTOR_RUN_ID] = runId;
        });

        afterEach(() => {
            delete process.env[ENV_VARS.IS_AT_HOME];
            delete process.env[ENV_VARS.ACTOR_ID];
            delete process.env[ENV_VARS.ACTOR_RUN_ID];
            jest.restoreAllMocks();
        });

        test('metamorphs to the same actor', async () => {
            const metamorphSpy = jest.spyOn(Actor.prototype, 'metamorph');
            metamorphSpy.mockResolvedValueOnce();

            await Actor.reboot();

            expect(metamorphSpy).toBeCalledTimes(1);
            expect(metamorphSpy).toBeCalledWith(actId);
        });

        test('reboot waits for persistState/migrating listeners before morphing', async () => {
            const metamorphSpy = jest.spyOn(Actor.prototype, 'metamorph');
            metamorphSpy.mockResolvedValueOnce();

            const persistenceStore = [];

            const persistResource = (delay: number) => async () : Promise<void> => {
                await new Promise((res) => setTimeout(res, delay));
                persistenceStore.push('PERSISTED ITEM');
            };

            const migratingSpy = jest.fn(persistResource(50));
            const persistStateSpy = jest.fn(persistResource(50));
            const events = Configuration.getEventManager();

            events.on(EventType.PERSIST_STATE, persistStateSpy);
            events.on(EventType.MIGRATING, migratingSpy);

            await Actor.reboot();

            events.off(EventType.PERSIST_STATE, persistStateSpy);
            events.off(EventType.MIGRATING, migratingSpy);

            // Do the listeners get called?
            expect(migratingSpy).toBeCalledTimes(1);
            expect(persistStateSpy).toBeCalledTimes(1);

            // Do the listeners finish?
            expect(persistenceStore.length).toBe(2);
        });
    });

    describe('Actor.addWebhook()', () => {
        const { runId } = globalOptions;
        const expectedEventTypes = ['ACTOR.RUN.SUCCEEDED'] as const;
        const expectedRequestUrl = 'http://example.com/api';
        const expectedPayloadTemplate = '{"hello":{{world}}';
        const expectedIdempotencyKey = 'some-key';
        const webhook = {
            isAdHoc: true,
            eventTypes: expectedEventTypes,
            condition: {
                actorRunId: runId,
            },
            requestUrl: expectedRequestUrl,
            payloadTemplate: expectedPayloadTemplate,
            idempotencyKey: expectedIdempotencyKey,
        };

        test('works', async () => {
            process.env[ENV_VARS.ACTOR_RUN_ID] = runId;
            process.env[ENV_VARS.IS_AT_HOME] = '1';

            const clientMock = jest.spyOn(Actor.apifyClient, 'webhooks')
                .mockReturnValueOnce({ create: async () => webhook } as any);

            await Actor.addWebhook({
                eventTypes: expectedEventTypes,
                requestUrl: expectedRequestUrl,
                payloadTemplate: expectedPayloadTemplate,
                idempotencyKey: expectedIdempotencyKey,
            });

            delete process.env[ENV_VARS.ACTOR_RUN_ID];
            delete process.env[ENV_VARS.IS_AT_HOME];

            expect(clientMock).toBeCalledTimes(1);
        });

        test('on local logs warning and does nothing', async () => {
            const clientMock = jest.spyOn(Actor.apifyClient, 'webhooks')
                .mockImplementation();

            const warningStub = jest.spyOn(log, 'warning').mockImplementation();

            await Actor.addWebhook({ eventTypes: expectedEventTypes, requestUrl: expectedRequestUrl });

            expect(warningStub).toBeCalledTimes(1);
            expect(clientMock).toBeCalledTimes(0);
        });

        test('should fail without actor run ID', async () => {
            process.env[ENV_VARS.IS_AT_HOME] = '1';

            await expect(async () => Actor.addWebhook({ eventTypes: expectedEventTypes, requestUrl: expectedRequestUrl }))
                .rejects
                .toThrow();

            delete process.env[ENV_VARS.IS_AT_HOME];
        });
    });

    describe('Actor.getInput', () => {
        test('should work', async () => {
            const defaultStore = await KeyValueStore.open();
            // Uses default value.
            const oldGet = defaultStore.getValue;
            // @ts-expect-error TODO use spyOn instead of this
            defaultStore.getValue = async (key) => expect(key).toEqual(KEY_VALUE_STORE_KEYS.INPUT);
            await Actor.getInput();

            // Uses value from env var.
            process.env[ENV_VARS.INPUT_KEY] = 'some-value';
            // @ts-expect-error TODO use spyOn instead of this
            defaultStore.getValue = async (key) => expect(key).toBe('some-value');
            await Actor.getInput();

            delete process.env[ENV_VARS.INPUT_KEY];

            defaultStore.getValue = oldGet;
        });
    });

    describe('Actor.setValue', () => {
        test('should work', async () => {
            const record = { foo: 'bar' };
            const defaultStore = await KeyValueStore.open();

            const oldSet = defaultStore.setValue;
            defaultStore.setValue = async (key, value) => {
                expect(key).toBe('key-1');
                expect(value).toBe(record);
            };

            await Actor.setValue('key-1', record);

            defaultStore.setValue = oldSet;
        });
    });

    describe('Actor.getValue', () => {
        test('should work', async () => {
            const defaultStore = await KeyValueStore.open();

            const oldGet = defaultStore.getValue;
            // @ts-expect-error TODO use spyOn instead of this
            defaultStore.getValue = async (key) => expect(key).toBe('key-1');

            await Actor.getValue('key-1');

            defaultStore.getValue = oldGet;
        });
    });

    describe('Actor.pushData', () => {
        test('should work', async () => {
            const defaultStore = await KeyValueStore.open();

            const oldGet = defaultStore.getValue;
            // @ts-expect-error TODO use spyOn instead of this
            defaultStore.getValue = async (key) => expect(key).toBe('key-1');

            await Actor.getValue('key-1');

            defaultStore.getValue = oldGet;
        });
    });
});
