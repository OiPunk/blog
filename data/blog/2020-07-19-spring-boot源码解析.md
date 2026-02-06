---
title: 'Spring Boot源码解析'
date: '2020-07-19'
tags: ['框架', 'Spring Boot', '源码']
draft: false
summary: 'Spring Boot核心源码讲解：启动、装配、运行、配置'
---

# 启动过程

### 1、springboot的入口程序

```java
@SpringBootApplicationpublic class StartupApplication {    public static void main(String[] args) {        SpringApplication.run(StartupApplication.class, args);    }}
```

当程序开始执行之后，会调用SpringApplication的构造方法，进行某些初始参数的设置

```java
//创建一个新的实例，这个应用程序的上下文将要从指定的来源加载Beanpublic SpringApplication(ResourceLoader resourceLoader, Class... primarySources) {    //资源初始化资源加载器，默认为null	this.resourceLoader = resourceLoader;    //断言主要加载资源类不能为 null，否则报错	Assert.notNull(primarySources, "PrimarySources must not be null");    //初始化主要加载资源类集合并去重	this.primarySources = new LinkedHashSet<>(Arrays.asList(primarySources));    //推断当前 WEB 应用类型，一共有三种：NONE,SERVLET,REACTIVE	this.webApplicationType = WebApplicationType.deduceFromClasspath();    //设置应用上线文初始化器,从"META-INF/spring.factories"读取ApplicationContextInitializer类的实例名称集合并去重，并进行set去重。（一共7个）	setInitializers((Collection) getSpringFactoriesInstances(ApplicationContextInitializer.class));    //设置监听器,从"META-INF/spring.factories"读取ApplicationListener类的实例名称集合并去重，并进行set去重。（一共11个）	setListeners((Collection) getSpringFactoriesInstances(ApplicationListener.class));    //推断主入口应用类，通过当前调用栈，获取Main方法所在类，并赋值给mainApplicationClass	this.mainApplicationClass = deduceMainApplicationClass();	}
```

在上述构造方法中，有一个判断应用类型的方法，用来判断当前应用程序的类型：

```java
static WebApplicationType deduceFromClasspath() {		if (ClassUtils.isPresent(WEBFLUX_INDICATOR_CLASS, null) && !ClassUtils.isPresent(WEBMVC_INDICATOR_CLASS, null)				&& !ClassUtils.isPresent(JERSEY_INDICATOR_CLASS, null)) {			return WebApplicationType.REACTIVE;		}		for (String className : SERVLET_INDICATOR_CLASSES) {			if (!ClassUtils.isPresent(className, null)) {				return WebApplicationType.NONE;			}		}		return WebApplicationType.SERVLET;	}//WebApplicationType的类型public enum WebApplicationType {	/**	 * The application should not run as a web application and should not start an	 * embedded web server.	 * 非web项目	 */	NONE,	/**	 * The application should run as a servlet-based web application and should start an	 * embedded servlet web server.	 * servlet web 项目	 */	SERVLET,	/**	 * The application should run as a reactive web application and should start an	 * embedded reactive web server.	 * 响应式 web 项目	 */	REACTIVE;
```

springboot启动的运行方法，可以看到主要是各种运行环境的准备工作

```java
public ConfigurableApplicationContext run(String... args) {    //1、创建并启动计时监控类	StopWatch stopWatch = new StopWatch();	stopWatch.start();    //2、初始化应用上下文和异常报告集合	ConfigurableApplicationContext context = null;	Collection exceptionReporters = new ArrayList<>();    //3、设置系统属性“java.awt.headless”的值，默认为true，用于运行headless服务器，进行简单的图像处理，多用于在缺少显示屏、键盘或者鼠标时的系统配置，很多监控工具如jconsole 需要将该值设置为true	configureHeadlessProperty();    //4、创建所有spring运行监听器并发布应用启动事件，简单说的话就是获取SpringApplicationRunListener类型的实例（EventPublishingRunListener对象），并封装进SpringApplicationRunListeners对象，然后返回这个SpringApplicationRunListeners对象。说的再简单点，getRunListeners就是准备好了运行时监听器EventPublishingRunListener。	SpringApplicationRunListeners listeners = getRunListeners(args);	listeners.starting();	try {        //5、初始化默认应用参数类		ApplicationArguments applicationArguments = new DefaultApplicationArguments(args);        //6、根据运行监听器和应用参数来准备spring环境		ConfigurableEnvironment environment = prepareEnvironment(listeners, applicationArguments);        //将要忽略的bean的参数打开		configureIgnoreBeanInfo(environment);        //7、创建banner打印类		Banner printedBanner = printBanner(environment);        //8、创建应用上下文，可以理解为创建一个容器		context = createApplicationContext();        //9、准备异常报告器，用来支持报告关于启动的错误		exceptionReporters = getSpringFactoriesInstances(SpringBootExceptionReporter.class,					new Class[] { ConfigurableApplicationContext.class }, context);        //10、准备应用上下文，该步骤包含一个非常关键的操作，将启动类注入容器，为后续开启自动化提供基础		prepareContext(context, environment, listeners, applicationArguments, printedBanner);        //11、刷新应用上下文		refreshContext(context);        //12、应用上下文刷新后置处理，做一些扩展功能		afterRefresh(context, applicationArguments);        //13、停止计时监控类		stopWatch.stop();        //14、输出日志记录执行主类名、时间信息		if (this.logStartupInfo) {				new StartupInfoLogger(this.mainApplicationClass).logStarted(getApplicationLog(), stopWatch);		}        //15、发布应用上下文启动监听事件		listeners.started(context);        //16、执行所有的Runner运行器		callRunners(context, applicationArguments);	}catch (Throwable ex) {		handleRunFailure(context, ex, exceptionReporters, listeners);		throw new IllegalStateException(ex);	}	try {        //17、发布应用上下文就绪事件		listeners.running(context);	}catch (Throwable ex) {		handleRunFailure(context, ex, exceptionReporters, null);		throw new IllegalStateException(ex);	}    //18、返回应用上下文	return context;}
```

下面详细介绍各个启动的环节：

1、创建并启动计时监控类，可以看到记录当前任务的名称，默认是空字符串，然后记录当前springboot应用启动的开始时间。

```java
StopWatch stopWatch = new StopWatch();stopWatch.start();//详细源代码public void start() throws IllegalStateException {	start("");}public void start(String taskName) throws IllegalStateException {	if (this.currentTaskName != null) {		throw new IllegalStateException("Can't start StopWatch: it's already running");	}	this.currentTaskName = taskName;	this.startTimeNanos = System.nanoTime();}
```

2、初始化应用上下文和异常报告集合

```java
ConfigurableApplicationContext context = null;Collection exceptionReporters = new ArrayList<>();
```

3、设置系统属性java.awt.headless的值：

```java
/*java.awt.headless模式是在缺少显示屏、键盘或者鼠标的系统配置当配置了如下属性之后，应用程序可以执行如下操作：	1、创建轻量级组件	2、收集关于可用的字体、字体指标和字体设置的信息	3、设置颜色来渲染准备图片	4、创造和获取图像，为渲染准备图片	5、使用java.awt.PrintJob,java.awt.print.*和javax.print.*类里的方法进行打印*/private void configureHeadlessProperty() {		System.setProperty(SYSTEM_PROPERTY_JAVA_AWT_HEADLESS,				System.getProperty(SYSTEM_PROPERTY_JAVA_AWT_HEADLESS, Boolean.toString(this.headless)));}
```

4、创建所有spring运行监听器并发布应用启动事件

```java
SpringApplicationRunListeners listeners = getRunListeners(args);listeners.starting();//创建spring监听器private SpringApplicationRunListeners getRunListeners(String[] args) {	Class[] types = new Class[] { SpringApplication.class, String[].class };	return new SpringApplicationRunListeners(logger,				getSpringFactoriesInstances(SpringApplicationRunListener.class, types, this, args));}SpringApplicationRunListeners(Log log, Collection listeners) {	this.log = log;	this.listeners = new ArrayList<>(listeners);}//循环遍历获取监听器void starting() {	for (SpringApplicationRunListener listener : this.listeners) {		listener.starting();	}}//此处的监听器可以看出是事件发布监听器，主要用来发布启动事件@Overridepublic void starting() {    //这里是创建application事件‘applicationStartingEvent’	this.initialMulticaster.multicastEvent(new ApplicationStartingEvent(this.application, this.args));}//applicationStartingEvent是springboot框架最早执行的监听器，在该监听器执行started方法时，会继续发布事件，主要是基于spring的事件机制	@Override	public void multicastEvent(final ApplicationEvent event, @Nullable ResolvableType eventType) {		ResolvableType type = (eventType != null ? eventType : resolveDefaultEventType(event));        //获取线程池，如果为空则同步处理。这里线程池为空，还未初始化		Executor executor = getTaskExecutor();		for (ApplicationListener listener : getApplicationListeners(event, type)) {			if (executor != null) {                //异步发送事件				executor.execute(() -> invokeListener(listener, event));			}			else {                //同步发送事件				invokeListener(listener, event);			}		}	}
```

5、初始化默认应用参数类

```java
ApplicationArguments applicationArguments = new DefaultApplicationArguments(args);public DefaultApplicationArguments(String... args) {	Assert.notNull(args, "Args must not be null");	this.source = new Source(args);	this.args = args;}
```

6、根据运行监听器和应用参数来准备spring环境

```java
ConfigurableEnvironment environment = prepareEnvironment(listeners, applicationArguments);//详细环境的准备private ConfigurableEnvironment prepareEnvironment(SpringApplicationRunListeners listeners,	ApplicationArguments applicationArguments) {	// 获取或者创建应用环境	ConfigurableEnvironment environment = getOrCreateEnvironment();    // 配置应用环境，配置propertySource和activeProfiles	configureEnvironment(environment, applicationArguments.getSourceArgs());    //listeners环境准备，广播ApplicationEnvironmentPreparedEvent	ConfigurationPropertySources.attach(environment);	listeners.environmentPrepared(environment);    //将环境绑定给当前应用程序	bindToSpringApplication(environment);    //对当前的环境类型进行判断，如果不一致进行转换	if (!this.isCustomEnvironment) {		environment = new EnvironmentConverter(getClassLoader()).convertEnvironmentIfNecessary(environment,					deduceEnvironmentClass());	}    //配置propertySource对它自己的递归依赖	ConfigurationPropertySources.attach(environment);	return environment;}// 获取或者创建应用环境，根据应用程序的类型可以分为servlet环境、标准环境(特殊的非web环境)和响应式环境private ConfigurableEnvironment getOrCreateEnvironment() {    //存在则直接返回		if (this.environment != null) {			return this.environment;		}    //根据webApplicationType创建对应的Environment		switch (this.webApplicationType) {		case SERVLET:			return new StandardServletEnvironment();		case REACTIVE:			return new StandardReactiveWebEnvironment();		default:			return new StandardEnvironment();		}	}//配置应用环境protected void configureEnvironment(ConfigurableEnvironment environment, String[] args) {	if (this.addConversionService) {		ConversionService conversionService = ApplicationConversionService.getSharedInstance();		environment.setConversionService((ConfigurableConversionService) conversionService);	}    //配置property sources	configurePropertySources(environment, args);    //配置profiles	configureProfiles(environment, args);}
```

7、创建banner的打印类

```java
Banner printedBanner = printBanner(environment);//打印类的详细操作过程private Banner printBanner(ConfigurableEnvironment environment) {		if (this.bannerMode == Banner.Mode.OFF) {			return null;		}		ResourceLoader resourceLoader = (this.resourceLoader != null) ? this.resourceLoader				: new DefaultResourceLoader(getClassLoader());		SpringApplicationBannerPrinter bannerPrinter = new SpringApplicationBannerPrinter(resourceLoader, this.banner);		if (this.bannerMode == Mode.LOG) {			return bannerPrinter.print(environment, this.mainApplicationClass, logger);		}		return bannerPrinter.print(environment, this.mainApplicationClass, System.out);	}
```

8、创建应用的上下文:根据不同哦那个的应用类型初始化不同的上下文应用类

```java
context = createApplicationContext();protected ConfigurableApplicationContext createApplicationContext() {		Class contextClass = this.applicationContextClass;		if (contextClass == null) {			try {				switch (this.webApplicationType) {				case SERVLET:					contextClass = Class.forName(DEFAULT_SERVLET_WEB_CONTEXT_CLASS);					break;				case REACTIVE:					contextClass = Class.forName(DEFAULT_REACTIVE_WEB_CONTEXT_CLASS);					break;				default:					contextClass = Class.forName(DEFAULT_CONTEXT_CLASS);				}			}			catch (ClassNotFoundException ex) {				throw new IllegalStateException(						"Unable create a default ApplicationContext, please specify an ApplicationContextClass", ex);			}		}		return (ConfigurableApplicationContext) BeanUtils.instantiateClass(contextClass);	}
```

9、准备异常报告器

```java
exceptionReporters = getSpringFactoriesInstances(SpringBootExceptionReporter.class,					new Class[] { ConfigurableApplicationContext.class }, context);private  Collection getSpringFactoriesInstances(Class type, Class[] parameterTypes, Object... args) {		ClassLoader classLoader = getClassLoader();		// Use names and ensure unique to protect against duplicates		Set names = new LinkedHashSet<>(SpringFactoriesLoader.loadFactoryNames(type, classLoader));		List instances = createSpringFactoriesInstances(type, parameterTypes, classLoader, args, names);		AnnotationAwareOrderComparator.sort(instances);		return instances;	}
```

10、准备应用上下文

```java
prepareContext(context, environment, listeners, applicationArguments, printedBanner);private void prepareContext(ConfigurableApplicationContext context, ConfigurableEnvironment environment,			SpringApplicationRunListeners listeners, ApplicationArguments applicationArguments, Banner printedBanner) {    	//应用上下文的environment		context.setEnvironment(environment);    	//应用上下文后处理		postProcessApplicationContext(context);    	//为上下文应用所有初始化器，执行容器中的applicationContextInitializer(spring.factories的实例)，将所有的初始化对象放置到context对象中		applyInitializers(context);    	//触发所有SpringApplicationRunListener监听器的ContextPrepared事件方法。添加所有的事件监听器		listeners.contextPrepared(context);   	 	//记录启动日志		if (this.logStartupInfo) {			logStartupInfo(context.getParent() == null);			logStartupProfileInfo(context);		}		// 注册启动参数bean，将容器指定的参数封装成bean，注入容器		ConfigurableListableBeanFactory beanFactory = context.getBeanFactory();		beanFactory.registerSingleton("springApplicationArguments", applicationArguments);    	//设置banner		if (printedBanner != null) {			beanFactory.registerSingleton("springBootBanner", printedBanner);		}		if (beanFactory instanceof DefaultListableBeanFactory) {			((DefaultListableBeanFactory) beanFactory)					.setAllowBeanDefinitionOverriding(this.allowBeanDefinitionOverriding);		}		if (this.lazyInitialization) {			context.addBeanFactoryPostProcessor(new LazyInitializationBeanFactoryPostProcessor());		}		// 加载所有资源，指的是启动器指定的参数		Set sources = getAllSources();		Assert.notEmpty(sources, "Sources must not be empty");    	//将bean加载到上下文中		load(context, sources.toArray(new Object[0]));    	//触发所有springapplicationRunListener监听器的contextLoaded事件方法，		listeners.contextLoaded(context);	}-------------------    //这里没有做任何的处理过程，因为beanNameGenerator和resourceLoader默认为空，可以方便后续做扩展处理    protected void postProcessApplicationContext(ConfigurableApplicationContext context) {		if (this.beanNameGenerator != null) {			context.getBeanFactory().registerSingleton(AnnotationConfigUtils.CONFIGURATION_BEAN_NAME_GENERATOR,					this.beanNameGenerator);		}		if (this.resourceLoader != null) {			if (context instanceof GenericApplicationContext) {				((GenericApplicationContext) context).setResourceLoader(this.resourceLoader);			}			if (context instanceof DefaultResourceLoader) {				((DefaultResourceLoader) context).setClassLoader(this.resourceLoader.getClassLoader());			}		}		if (this.addConversionService) {			context.getBeanFactory().setConversionService(ApplicationConversionService.getSharedInstance());		}	}---------------------    //将启动器类加载到spring容器中，为后续的自动化配置奠定基础，之前看到的很多注解也与此相关    protected void load(ApplicationContext context, Object[] sources) {		if (logger.isDebugEnabled()) {			logger.debug("Loading source " + StringUtils.arrayToCommaDelimitedString(sources));		}		BeanDefinitionLoader loader = createBeanDefinitionLoader(getBeanDefinitionRegistry(context), sources);		if (this.beanNameGenerator != null) {			loader.setBeanNameGenerator(this.beanNameGenerator);		}		if (this.resourceLoader != null) {			loader.setResourceLoader(this.resourceLoader);		}		if (this.environment != null) {			loader.setEnvironment(this.environment);		}		loader.load();	}---------------------    //springboot会优先选择groovy加载方式，找不到在选择java方式    private int load(Class source) {		if (isGroovyPresent() && GroovyBeanDefinitionSource.class.isAssignableFrom(source)) {			// Any GroovyLoaders added in beans{} DSL can contribute beans here			GroovyBeanDefinitionSource loader = BeanUtils.instantiateClass(source, GroovyBeanDefinitionSource.class);			load(loader);		}		if (isComponent(source)) {			this.annotatedReader.register(source);			return 1;		}		return 0;	}
```

11、刷新应用上下文

```java
refreshContext(context);private void refreshContext(ConfigurableApplicationContext context) {		refresh(context);		if (this.registerShutdownHook) {			try {				context.registerShutdownHook();			}			catch (AccessControlException ex) {				// Not allowed in some environments.			}		}	}------------    public void refresh() throws BeansException, IllegalStateException {		synchronized (this.startupShutdownMonitor) {			// Prepare this context for refreshing.            //刷新上下文环境，初始化上下文环境，对系统的环境变量或者系统属性进行准备和校验			prepareRefresh();			// Tell the subclass to refresh the internal bean factory.            //初始化beanfactory，解析xml，相当于之前的xmlBeanfactory操作			ConfigurableListableBeanFactory beanFactory = obtainFreshBeanFactory();			// Prepare the bean factory for use in this context.            //为上下文准备beanfactory，对beanFactory的各种功能进行填充，如@autowired，设置spel表达式解析器，设置编辑注册器，添加applicationContextAwareprocessor处理器等等			prepareBeanFactory(beanFactory);			try {				// Allows post-processing of the bean factory in context subclasses.                //提供子类覆盖的额外处理，即子类处理自定义的beanfactorypostProcess				postProcessBeanFactory(beanFactory);				// Invoke factory processors registered as beans in the context.                //激活各种beanfactory处理器				invokeBeanFactoryPostProcessors(beanFactory);				// Register bean processors that intercept bean creation.                //注册拦截bean创建的bean处理器，即注册beanPostProcessor				registerBeanPostProcessors(beanFactory);				// Initialize message source for this context.                //初始化上下文中的资源文件如国际化文件的处理				initMessageSource();				// Initialize event multicaster for this context.                //初始化上下文事件广播器				initApplicationEventMulticaster();				// Initialize other special beans in specific context subclasses.                //给子类扩展初始化其他bean				onRefresh();				// Check for listener beans and register them.                //在所有的bean中查找listener bean,然后 注册到广播器中				registerListeners();				// Instantiate all remaining (non-lazy-init) singletons.                //初始化剩余的非懒惰的bean，即初始化非延迟加载的bean				finishBeanFactoryInitialization(beanFactory);				// Last step: publish corresponding event.                //发完成刷新过程，通知声明周期处理器刷新过程，同时发出ContextRefreshEvent通知别人				finishRefresh();			}			catch (BeansException ex) {				if (logger.isWarnEnabled()) {					logger.warn("Exception encountered during context initialization - " +							"cancelling refresh attempt: " + ex);				}				// Destroy already created singletons to avoid dangling resources.				destroyBeans();				// Reset 'active' flag.				cancelRefresh(ex);				// Propagate exception to caller.				throw ex;			}			finally {				// Reset common introspection caches in Spring's core, since we				// might not ever need metadata for singleton beans anymore...				resetCommonCaches();			}		}	}
```

12、应用上下文刷新后置处理

```java
afterRefresh(context, applicationArguments);//当前方法的代码是空的，可以做一些自定义的后置处理操作protected void afterRefresh(ConfigurableApplicationContext context, ApplicationArguments args) {	}
```

13、停止计时监控类：计时监听器停止，并统计一些任务执行信息

```java
stopWatch.stop();public void stop() throws IllegalStateException {		if (this.currentTaskName == null) {			throw new IllegalStateException("Can't stop StopWatch: it's not running");		}		long lastTime = System.nanoTime() - this.startTimeNanos;		this.totalTimeNanos += lastTime;		this.lastTaskInfo = new TaskInfo(this.currentTaskName, lastTime);		if (this.keepTaskList) {			this.taskList.add(this.lastTaskInfo);		}		++this.taskCount;		this.currentTaskName = null;	}
```

14、输出日志记录执行主类名、时间信息

```java
if (this.logStartupInfo) {	new StartupInfoLogger(this.mainApplicationClass).logStarted(getApplicationLog(), stopWatch);}
```

15、发布应用上下文启动完成事件：触发所有SpringapplicationRunListener监听器的started事件方法

```java
listeners.started(context);	void started(ConfigurableApplicationContext context) {		for (SpringApplicationRunListener listener : this.listeners) {			listener.started(context);		}	}
```

16、执行所有Runner执行器：执行所有applicationRunner和CommandLineRunner两种运行器

```java
callRunners(context, applicationArguments);private void callRunners(ApplicationContext context, ApplicationArguments args) {		List runners = new ArrayList<>();		runners.addAll(context.getBeansOfType(ApplicationRunner.class).values());		runners.addAll(context.getBeansOfType(CommandLineRunner.class).values());		AnnotationAwareOrderComparator.sort(runners);		for (Object runner : new LinkedHashSet<>(runners)) {			if (runner instanceof ApplicationRunner) {				callRunner((ApplicationRunner) runner, args);			}			if (runner instanceof CommandLineRunner) {				callRunner((CommandLineRunner) runner, args);			}		}	}
```

17、发布应用上下文就绪事件：触发所有springapplicationRunnListener将挺起的running事件方法

```java
listeners.running(context);void running(ConfigurableApplicationContext context) {		for (SpringApplicationRunListener listener : this.listeners) {			listener.running(context);		}	}
```

18、返回应用上下文

```java
return context;
```

---

注意：

整个springboot框架中获取factorys文件的方式统一如下：

```java
private  Collection getSpringFactoriesInstances(Class type) {	return getSpringFactoriesInstances(type, new Class[] {});}-------------------------------------private  Collection getSpringFactoriesInstances(Class type, Class[] parameterTypes, Object... args) {		ClassLoader classLoader = getClassLoader();		// Use names and ensure unique to protect against duplicates		Set names = new LinkedHashSet<>(SpringFactoriesLoader.loadFactoryNames(type, classLoader));		List instances = createSpringFactoriesInstances(type, parameterTypes, classLoader, args, names);		AnnotationAwareOrderComparator.sort(instances);		return instances;}-----------------------------    public static List loadFactoryNames(Class factoryType, @Nullable ClassLoader classLoader) {		String factoryTypeName = factoryType.getName();		return loadSpringFactories(classLoader).getOrDefault(factoryTypeName, Collections.emptyList());	}	private static Map> loadSpringFactories(@Nullable ClassLoader classLoader) {		MultiValueMap result = cache.get(classLoader);		if (result != null) {			return result;		}		try {			Enumeration urls = (classLoader != null ?					classLoader.getResources(FACTORIES_RESOURCE_LOCATION) :					ClassLoader.getSystemResources(FACTORIES_RESOURCE_LOCATION));			result = new LinkedMultiValueMap<>();			while (urls.hasMoreElements()) {				URL url = urls.nextElement();				UrlResource resource = new UrlResource(url);				Properties properties = PropertiesLoaderUtils.loadProperties(resource);				for (Map.Entry entry : properties.entrySet()) {					String factoryTypeName = ((String) entry.getKey()).trim();					for (String factoryImplementationName : StringUtils.commaDelimitedListToStringArray((String) entry.getValue())) {						result.add(factoryTypeName, factoryImplementationName.trim());					}				}			}			cache.put(classLoader, result);			return result;		}		catch (IOException ex) {			throw new IllegalArgumentException("Unable to load factories from location [" +					FACTORIES_RESOURCE_LOCATION + "]", ex);		}	}-------------------------    private  List createSpringFactoriesInstances(Class type, Class[] parameterTypes,			ClassLoader classLoader, Object[] args, Set names) {		List instances = new ArrayList<>(names.size());		for (String name : names) {			try {                //装载class文件到内存				Class instanceClass = ClassUtils.forName(name, classLoader);				Assert.isAssignable(type, instanceClass);				Constructor constructor = instanceClass.getDeclaredConstructor(parameterTypes);                //通过反射创建实例				T instance = (T) BeanUtils.instantiateClass(constructor, args);				instances.add(instance);			}			catch (Throwable ex) {				throw new IllegalArgumentException("Cannot instantiate " + type + " : " + name, ex);			}		}		return instances;	}
```

spring.factory文件中的类的作用：

```properties
# PropertySource Loaders 属性文件加载器org.springframework.boot.env.PropertySourceLoader=\# properties文件加载器org.springframework.boot.env.PropertiesPropertySourceLoader,\# yaml文件加载器org.springframework.boot.env.YamlPropertySourceLoader# Run Listeners 运行时的监听器org.springframework.boot.SpringApplicationRunListener=\# 程序运行过程中所有监听通知都是通过此类来进行回调org.springframework.boot.context.event.EventPublishingRunListener# Error Reporters	错误报告器org.springframework.boot.SpringBootExceptionReporter=\org.springframework.boot.diagnostics.FailureAnalyzers# Application Context Initializersorg.springframework.context.ApplicationContextInitializer=\# 报告spring容器的一些常见的错误配置org.springframework.boot.context.ConfigurationWarningsApplicationContextInitializer,\# 设置spring应用上下文的IDorg.springframework.boot.context.ContextIdApplicationContextInitializer,\# 使用环境属性context.initializer.classes指定初始化器进行初始化规则org.springframework.boot.context.config.DelegatingApplicationContextInitializer,\org.springframework.boot.rsocket.context.RSocketPortInfoApplicationContextInitializer,\# 将内置servlet容器实际使用的监听端口写入到environment环境属性中org.springframework.boot.web.context.ServerPortInfoApplicationContextInitializer# Application Listenersorg.springframework.context.ApplicationListener=\# 应用上下文加载完成后对缓存做清除工作，响应事件ContextRefreshEventorg.springframework.boot.ClearCachesApplicationListener,\# 监听双亲应用上下文的关闭事件并往自己的孩子应用上下文中传播，相关事件ParentContextAvailableEvent/ContextClosedEventorg.springframework.boot.builder.ParentContextCloserApplicationListener,\org.springframework.boot.cloud.CloudFoundryVcapEnvironmentPostProcessor,\# 如果系统文件编码和环境变量中指定的不同则终止应用启动。具体的方法是比较系统属性file.encoding和环境变量spring.mandatory-file-encoding是否相等(大小写不敏感)。org.springframework.boot.context.FileEncodingApplicationListener,\# 根据spring.output.ansi.enabled参数配置AnsiOutputorg.springframework.boot.context.config.AnsiOutputApplicationListener,\# EnvironmentPostProcessor，从常见的那些约定的位置读取配置文件，比如从以下目录读取#application.properties,application.yml等配置文件：# classpath:# file:.# classpath:config# file:./config/:# 也可以配置成从其他指定的位置读取配置文件org.springframework.boot.context.config.ConfigFileApplicationListener,\# 监听到事件后转发给环境变量context.listener.classes指定的那些事件监听器org.springframework.boot.context.config.DelegatingApplicationListener,\# 一个SmartApplicationListener,对环境就绪事件ApplicationEnvironmentPreparedEvent/应用失败事件ApplicationFailedEvent做出响应，往日志DEBUG级别输出TCCL(thread context class loader)的classpath。org.springframework.boot.context.logging.ClasspathLoggingApplicationListener,\# 检测正在使用的日志系统，默认时logback，，此时日志系统还没有初始化org.springframework.boot.context.logging.LoggingApplicationListener,\# 使用一个可以和Spring Boot可执行jar包配合工作的版本替换liquibase ServiceLocatororg.springframework.boot.liquibase.LiquibaseServiceLocatorApplicationListener
```

# 自动装配

​ 在之前的课程中我们讲解了springboot的启动过程，其实在面试过程中问的最多的可能是自动装配的原理，而自动装配是在启动过程中完成，只不过在刚开始的时候我们选择性的跳过了，下面详细讲解自动装配的过程。

##### 1、在springboot的启动过程中，有一个步骤是创建上下文，如果不记得可以看下面的代码：

```java
public ConfigurableApplicationContext run(String... args) {		StopWatch stopWatch = new StopWatch();		stopWatch.start();		ConfigurableApplicationContext context = null;		Collection exceptionReporters = new ArrayList<>();		configureHeadlessProperty();		SpringApplicationRunListeners listeners = getRunListeners(args);		listeners.starting();		try {			ApplicationArguments applicationArguments = new DefaultApplicationArguments(args);			ConfigurableEnvironment environment = prepareEnvironment(listeners, applicationArguments);			configureIgnoreBeanInfo(environment);			Banner printedBanner = printBanner(environment);			context = createApplicationContext();			exceptionReporters = getSpringFactoriesInstances(SpringBootExceptionReporter.class,					new Class[] { ConfigurableApplicationContext.class }, context);            //此处完成自动装配的过程			prepareContext(context, environment, listeners, applicationArguments, printedBanner);			refreshContext(context);			afterRefresh(context, applicationArguments);			stopWatch.stop();			if (this.logStartupInfo) {				new StartupInfoLogger(this.mainApplicationClass).logStarted(getApplicationLog(), stopWatch);			}			listeners.started(context);			callRunners(context, applicationArguments);		}		catch (Throwable ex) {			handleRunFailure(context, ex, exceptionReporters, listeners);			throw new IllegalStateException(ex);		}		try {			listeners.running(context);		}		catch (Throwable ex) {			handleRunFailure(context, ex, exceptionReporters, null);			throw new IllegalStateException(ex);		}		return context;	}
```

##### 2、在prepareContext方法中查找load方法，一层一层向内点击，找到最终的load方法

```java
//prepareContext方法	private void prepareContext(ConfigurableApplicationContext context, ConfigurableEnvironment environment,			SpringApplicationRunListeners listeners, ApplicationArguments applicationArguments, Banner printedBanner) {		context.setEnvironment(environment);		postProcessApplicationContext(context);		applyInitializers(context);		listeners.contextPrepared(context);		if (this.logStartupInfo) {			logStartupInfo(context.getParent() == null);			logStartupProfileInfo(context);		}		// Add boot specific singleton beans		ConfigurableListableBeanFactory beanFactory = context.getBeanFactory();		beanFactory.registerSingleton("springApplicationArguments", applicationArguments);		if (printedBanner != null) {			beanFactory.registerSingleton("springBootBanner", printedBanner);		}		if (beanFactory instanceof DefaultListableBeanFactory) {			((DefaultListableBeanFactory) beanFactory)					.setAllowBeanDefinitionOverriding(this.allowBeanDefinitionOverriding);		}		if (this.lazyInitialization) {			context.addBeanFactoryPostProcessor(new LazyInitializationBeanFactoryPostProcessor());		}		// Load the sources		Set sources = getAllSources();		Assert.notEmpty(sources, "Sources must not be empty");        //load方法完成该功能		load(context, sources.toArray(new Object[0]));		listeners.contextLoaded(context);	}	/**	 * Load beans into the application context.	 * @param context the context to load beans into	 * @param sources the sources to load	 * 加载bean对象到context中	 */	protected void load(ApplicationContext context, Object[] sources) {		if (logger.isDebugEnabled()) {			logger.debug("Loading source " + StringUtils.arrayToCommaDelimitedString(sources));		}        //获取bean对象定义的加载器		BeanDefinitionLoader loader = createBeanDefinitionLoader(getBeanDefinitionRegistry(context), sources);		if (this.beanNameGenerator != null) {			loader.setBeanNameGenerator(this.beanNameGenerator);		}		if (this.resourceLoader != null) {			loader.setResourceLoader(this.resourceLoader);		}		if (this.environment != null) {			loader.setEnvironment(this.environment);		}		loader.load();	}	/**	 * Load the sources into the reader.	 * @return the number of loaded beans	 */	int load() {		int count = 0;		for (Object source : this.sources) {			count += load(source);		}		return count;	}
```

##### 3、实际执行load的是BeanDefinitionLoader中的load方法，如下：

```java
//实际记载bean的方法private int load(Object source) {	Assert.notNull(source, "Source must not be null");       //如果是class类型，启用注解类型	if (source instanceof Class) {		return load((Class) source);	}       //如果是resource类型，启动xml解析	if (source instanceof Resource) {		return load((Resource) source);	}       //如果是package类型，启用扫描包，例如@ComponentScan	if (source instanceof Package) {		return load((Package) source);	}       //如果是字符串类型，直接加载	if (source instanceof CharSequence) {		return load((CharSequence) source);	}	throw new IllegalArgumentException("Invalid source type " + source.getClass());}
```

##### 4、下面方法将用来判断是否资源的类型，是使用groovy加载还是使用注解的方式

```java
private int load(Class source) {       //判断使用groovy脚本	if (isGroovyPresent() && GroovyBeanDefinitionSource.class.isAssignableFrom(source)) {		// Any GroovyLoaders added in beans{} DSL can contribute beans here		GroovyBeanDefinitionSource loader = BeanUtils.instantiateClass(source, GroovyBeanDefinitionSource.class);		load(loader);	}       //使用注解加载	if (isComponent(source)) {		this.annotatedReader.register(source);		return 1;	}	return 0;}
```

##### 5、下面方法判断启动类中是否包含@Component注解，但是会神奇的发现我们的启动类中并没有该注解，继续更进发现MergedAnnotations类传入了一个参数SearchStrategy.TYPE_HIERARCHY，会查找继承关系中是否包含这个注解，@SpringBootApplication–>@SpringBootConfiguration–>@Configuration–>@Component,当找到@Component注解之后，会把该对象注册到AnnotatedBeanDefinitionReader对象中

```java
private boolean isComponent(Class type) {   // This has to be a bit of a guess. The only way to be sure that this type is   // eligible is to make a bean definition out of it and try to instantiate it.   if (MergedAnnotations.from(type, SearchStrategy.TYPE_HIERARCHY).isPresent(Component.class)) {      return true;   }   // Nested anonymous classes are not eligible for registration, nor are groovy   // closures   return !type.getName().matches(".*\\$_.*closure.*") && !type.isAnonymousClass()         && type.getConstructors() != null && type.getConstructors().length != 0;}	/**	 * Register a bean from the given bean class, deriving its metadata from	 * class-declared annotations.	 * 从给定的bean class中注册一个bean对象，从注解中找到相关的元数据	 */	private  void doRegisterBean(Class beanClass, @Nullable String name,			@Nullable Class[] qualifiers, @Nullable Supplier supplier,			@Nullable BeanDefinitionCustomizer[] customizers) {		AnnotatedGenericBeanDefinition abd = new AnnotatedGenericBeanDefinition(beanClass);		if (this.conditionEvaluator.shouldSkip(abd.getMetadata())) {			return;		}		abd.setInstanceSupplier(supplier);		ScopeMetadata scopeMetadata = this.scopeMetadataResolver.resolveScopeMetadata(abd);		abd.setScope(scopeMetadata.getScopeName());		String beanName = (name != null ? name : this.beanNameGenerator.generateBeanName(abd, this.registry));		AnnotationConfigUtils.processCommonDefinitionAnnotations(abd);		if (qualifiers != null) {			for (Class qualifier : qualifiers) {				if (Primary.class == qualifier) {					abd.setPrimary(true);				}				else if (Lazy.class == qualifier) {					abd.setLazyInit(true);				}				else {					abd.addQualifier(new AutowireCandidateQualifier(qualifier));				}			}		}		if (customizers != null) {			for (BeanDefinitionCustomizer customizer : customizers) {				customizer.customize(abd);			}		}		BeanDefinitionHolder definitionHolder = new BeanDefinitionHolder(abd, beanName);		definitionHolder = AnnotationConfigUtils.applyScopedProxyMode(scopeMetadata, definitionHolder, this.registry);		BeanDefinitionReaderUtils.registerBeanDefinition(definitionHolder, this.registry);	}	/**	 * Register the given bean definition with the given bean factory.	 * 注册主类，如果有别名可以设置别名	 */	public static void registerBeanDefinition(			BeanDefinitionHolder definitionHolder, BeanDefinitionRegistry registry)			throws BeanDefinitionStoreException {		// Register bean definition under primary name.		String beanName = definitionHolder.getBeanName();		registry.registerBeanDefinition(beanName, definitionHolder.getBeanDefinition());		// Register aliases for bean name, if any.		String[] aliases = definitionHolder.getAliases();		if (aliases != null) {			for (String alias : aliases) {				registry.registerAlias(beanName, alias);			}		}	}//@SpringBootApplication@Target(ElementType.TYPE)@Retention(RetentionPolicy.RUNTIME)@Documented@Inherited@SpringBootConfiguration@EnableAutoConfiguration@ComponentScan(excludeFilters = { @Filter(type = FilterType.CUSTOM, classes = TypeExcludeFilter.class),		@Filter(type = FilterType.CUSTOM, classes = AutoConfigurationExcludeFilter.class) })public @interface SpringBootApplication {}//@SpringBootConfiguration@Target(ElementType.TYPE)@Retention(RetentionPolicy.RUNTIME)@Documented@Configurationpublic @interface SpringBootConfiguration {}//@Configuration@Target(ElementType.TYPE)@Retention(RetentionPolicy.RUNTIME)@Documented@Componentpublic @interface Configuration {}
```

当看完上述代码之后，只是完成了启动对象的注入，自动装配还没有开始，下面开始进入到自动装配。

##### 6、自动装配入口，从刷新容器开始

```java
@Override	public void refresh() throws BeansException, IllegalStateException {		synchronized (this.startupShutdownMonitor) {			// Prepare this context for refreshing.			prepareRefresh();			// Tell the subclass to refresh the internal bean factory.			ConfigurableListableBeanFactory beanFactory = obtainFreshBeanFactory();			// Prepare the bean factory for use in this context.			prepareBeanFactory(beanFactory);			try {				// Allows post-processing of the bean factory in context subclasses.				postProcessBeanFactory(beanFactory);				// Invoke factory processors registered as beans in the context.                // 此处是自动装配的入口				invokeBeanFactoryPostProcessors(beanFactory);            }
```

##### 7、在invokeBeanFactoryPostProcessors方法中完成bean的实例化和执行

```java
/**	 * Instantiate and invoke all registered BeanFactoryPostProcessor beans,	 * respecting explicit order if given.	 *
```

##### 8、查看invokeBeanFactoryPostProcessors的具体执行方法

```java
public static void invokeBeanFactoryPostProcessors(		ConfigurableListableBeanFactory beanFactory, List beanFactoryPostProcessors) {	// Invoke BeanDefinitionRegistryPostProcessors first, if any.	Set processedBeans = new HashSet<>();	if (beanFactory instanceof BeanDefinitionRegistry) {		BeanDefinitionRegistry registry = (BeanDefinitionRegistry) beanFactory;		List regularPostProcessors = new ArrayList<>();		List registryProcessors = new ArrayList<>();		//开始遍历三个内部类，如果属于BeanDefinitionRegistryPostProcessor子类，加入到bean注册的集合，否则加入到regularPostProcessors		for (BeanFactoryPostProcessor postProcessor : beanFactoryPostProcessors) {			if (postProcessor instanceof BeanDefinitionRegistryPostProcessor) {				BeanDefinitionRegistryPostProcessor registryProcessor =						(BeanDefinitionRegistryPostProcessor) postProcessor;				registryProcessor.postProcessBeanDefinitionRegistry(registry);				registryProcessors.add(registryProcessor);			}			else {				regularPostProcessors.add(postProcessor);			}		}		// Do not initialize FactoryBeans here: We need to leave all regular beans		// uninitialized to let the bean factory post-processors apply to them!		// Separate between BeanDefinitionRegistryPostProcessors that implement		// PriorityOrdered, Ordered, and the rest.		List currentRegistryProcessors = new ArrayList<>();		// First, invoke the BeanDefinitionRegistryPostProcessors that implement PriorityOrdered.           //通过BeanDefinitionRegistryPostProcessor获取到对应的处理类“org.springframework.context.annotation.internalConfigurationAnnotationProcessor”，但是需要注意的是这个类在springboot中搜索不到，这个类的完全限定名在AnnotationConfigEmbeddedWebApplicationContext中，在进行初始化的时候会装配几个类，在创建AnnotatedBeanDefinitionReader对象的时候会将该类注册到bean对象中，此处可以看到internalConfigurationAnnotationProcessor为bean名称，容器中真正的类是ConfigurationClassPostProcessor		String[] postProcessorNames =				beanFactory.getBeanNamesForType(BeanDefinitionRegistryPostProcessor.class, true, false);           //首先执行类型为PriorityOrdered的BeanDefinitionRegistryPostProcessor           //PriorityOrdered类型表明为优先执行		for (String ppName : postProcessorNames) {			if (beanFactory.isTypeMatch(ppName, PriorityOrdered.class)) {                   //获取对应的bean				currentRegistryProcessors.add(beanFactory.getBean(ppName, BeanDefinitionRegistryPostProcessor.class));                   //用来存储已经执行过的BeanDefinitionRegistryPostProcessor				processedBeans.add(ppName);			}		}		sortPostProcessors(currentRegistryProcessors, beanFactory);		registryProcessors.addAll(currentRegistryProcessors);           //开始执行装配逻辑		invokeBeanDefinitionRegistryPostProcessors(currentRegistryProcessors, registry);		currentRegistryProcessors.clear();		// Next, invoke the BeanDefinitionRegistryPostProcessors that implement Ordered.           //其次执行类型为Ordered的BeanDefinitionRegistryPostProcessor           //Ordered表明按顺序执行		postProcessorNames = beanFactory.getBeanNamesForType(BeanDefinitionRegistryPostProcessor.class, true, false);		for (String ppName : postProcessorNames) {			if (!processedBeans.contains(ppName) && beanFactory.isTypeMatch(ppName, Ordered.class)) {				currentRegistryProcessors.add(beanFactory.getBean(ppName, BeanDefinitionRegistryPostProcessor.class));				processedBeans.add(ppName);			}		}		sortPostProcessors(currentRegistryProcessors, beanFactory);		registryProcessors.addAll(currentRegistryProcessors);		invokeBeanDefinitionRegistryPostProcessors(currentRegistryProcessors, registry);		currentRegistryProcessors.clear();		// Finally, invoke all other BeanDefinitionRegistryPostProcessors until no further ones appear.           //循环中执行类型不为PriorityOrdered，Ordered类型的BeanDefinitionRegistryPostProcessor		boolean reiterate = true;		while (reiterate) {			reiterate = false;			postProcessorNames = beanFactory.getBeanNamesForType(BeanDefinitionRegistryPostProcessor.class, true, false);			for (String ppName : postProcessorNames) {				if (!processedBeans.contains(ppName)) {					currentRegistryProcessors.add(beanFactory.getBean(ppName, BeanDefinitionRegistryPostProcessor.class));					processedBeans.add(ppName);					reiterate = true;				}			}			sortPostProcessors(currentRegistryProcessors, beanFactory);			registryProcessors.addAll(currentRegistryProcessors);			invokeBeanDefinitionRegistryPostProcessors(currentRegistryProcessors, registry);			currentRegistryProcessors.clear();		}		// Now, invoke the postProcessBeanFactory callback of all processors handled so far.	           //执行父类方法，优先执行注册处理类		invokeBeanFactoryPostProcessors(registryProcessors, beanFactory);           //执行有规则处理类		invokeBeanFactoryPostProcessors(regularPostProcessors, beanFactory);	}	else {		// Invoke factory processors registered with the context instance.		invokeBeanFactoryPostProcessors(beanFactoryPostProcessors, beanFactory);	}	// Do not initialize FactoryBeans here: We need to leave all regular beans	// uninitialized to let the bean factory post-processors apply to them!	String[] postProcessorNames =			beanFactory.getBeanNamesForType(BeanFactoryPostProcessor.class, true, false);	// Separate between BeanFactoryPostProcessors that implement PriorityOrdered,	// Ordered, and the rest.	List priorityOrderedPostProcessors = new ArrayList<>();	List orderedPostProcessorNames = new ArrayList<>();	List nonOrderedPostProcessorNames = new ArrayList<>();	for (String ppName : postProcessorNames) {		if (processedBeans.contains(ppName)) {			// skip - already processed in first phase above		}		else if (beanFactory.isTypeMatch(ppName, PriorityOrdered.class)) {			priorityOrderedPostProcessors.add(beanFactory.getBean(ppName, BeanFactoryPostProcessor.class));		}		else if (beanFactory.isTypeMatch(ppName, Ordered.class)) {			orderedPostProcessorNames.add(ppName);		}		else {			nonOrderedPostProcessorNames.add(ppName);		}	}	// First, invoke the BeanFactoryPostProcessors that implement PriorityOrdered.	sortPostProcessors(priorityOrderedPostProcessors, beanFactory);	invokeBeanFactoryPostProcessors(priorityOrderedPostProcessors, beanFactory);	// Next, invoke the BeanFactoryPostProcessors that implement Ordered.	List orderedPostProcessors = new ArrayList<>(orderedPostProcessorNames.size());	for (String postProcessorName : orderedPostProcessorNames) {		orderedPostProcessors.add(beanFactory.getBean(postProcessorName, BeanFactoryPostProcessor.class));	}	sortPostProcessors(orderedPostProcessors, beanFactory);	invokeBeanFactoryPostProcessors(orderedPostProcessors, beanFactory);	// Finally, invoke all other BeanFactoryPostProcessors.	List nonOrderedPostProcessors = new ArrayList<>(nonOrderedPostProcessorNames.size());	for (String postProcessorName : nonOrderedPostProcessorNames) {		nonOrderedPostProcessors.add(beanFactory.getBean(postProcessorName, BeanFactoryPostProcessor.class));	}	invokeBeanFactoryPostProcessors(nonOrderedPostProcessors, beanFactory);	// Clear cached merged bean definitions since the post-processors might have	// modified the original metadata, e.g. replacing placeholders in values...	beanFactory.clearMetadataCache();}
```

9、开始执行自动配置逻辑（启动类指定的配置，非默认配置），可以通过debug的方式一层层向里进行查找，会发现最终会在ConfigurationClassParser类中，此类是所有配置类的解析类，所有的解析逻辑在parser.parse(candidates)中

```java
public void parse(Set configCandidates) {		for (BeanDefinitionHolder holder : configCandidates) {			BeanDefinition bd = holder.getBeanDefinition();			try {                //是否是注解类				if (bd instanceof AnnotatedBeanDefinition) {					parse(((AnnotatedBeanDefinition) bd).getMetadata(), holder.getBeanName());				}				else if (bd instanceof AbstractBeanDefinition && ((AbstractBeanDefinition) bd).hasBeanClass()) {					parse(((AbstractBeanDefinition) bd).getBeanClass(), holder.getBeanName());				}				else {					parse(bd.getBeanClassName(), holder.getBeanName());				}			}			catch (BeanDefinitionStoreException ex) {				throw ex;			}			catch (Throwable ex) {				throw new BeanDefinitionStoreException(						"Failed to parse configuration class [" + bd.getBeanClassName() + "]", ex);			}		}    	//执行配置类		this.deferredImportSelectorHandler.process();	}-------------------    	protected final void parse(AnnotationMetadata metadata, String beanName) throws IOException {		processConfigurationClass(new ConfigurationClass(metadata, beanName));	}-------------------    protected void processConfigurationClass(ConfigurationClass configClass) throws IOException {		if (this.conditionEvaluator.shouldSkip(configClass.getMetadata(), ConfigurationPhase.PARSE_CONFIGURATION)) {			return;		}		ConfigurationClass existingClass = this.configurationClasses.get(configClass);		if (existingClass != null) {			if (configClass.isImported()) {				if (existingClass.isImported()) {					existingClass.mergeImportedBy(configClass);				}				// Otherwise ignore new imported config class; existing non-imported class overrides it.				return;			}			else {				// Explicit bean definition found, probably replacing an import.				// Let's remove the old one and go with the new one.				this.configurationClasses.remove(configClass);				this.knownSuperclasses.values().removeIf(configClass::equals);			}		}		// Recursively process the configuration class and its superclass hierarchy.		SourceClass sourceClass = asSourceClass(configClass);		do {            //循环处理bean,如果有父类，则处理父类，直至结束			sourceClass = doProcessConfigurationClass(configClass, sourceClass);		}		while (sourceClass != null);		this.configurationClasses.put(configClass, configClass);	}
```

10、继续跟进doProcessConfigurationClass方法，此方式是支持注解配置的核心逻辑

```java
/**	 * Apply processing and build a complete {@link ConfigurationClass} by reading the	 * annotations, members and methods from the source class. This method can be called	 * multiple times as relevant sources are discovered.	 * @param configClass the configuration class being build	 * @param sourceClass a source class	 * @return the superclass, or {@code null} if none found or previously processed	 */	@Nullable	protected final SourceClass doProcessConfigurationClass(ConfigurationClass configClass, SourceClass sourceClass)			throws IOException {        //处理内部类逻辑，由于传来的参数是启动类，并不包含内部类，所以跳过		if (configClass.getMetadata().isAnnotated(Component.class.getName())) {			// Recursively process any member (nested) classes first			processMemberClasses(configClass, sourceClass);		}		// Process any @PropertySource annotations        //针对属性配置的解析		for (AnnotationAttributes propertySource : AnnotationConfigUtils.attributesForRepeatable(				sourceClass.getMetadata(), PropertySources.class,				org.springframework.context.annotation.PropertySource.class)) {			if (this.environment instanceof ConfigurableEnvironment) {				processPropertySource(propertySource);			}			else {				logger.info("Ignoring @PropertySource annotation on [" + sourceClass.getMetadata().getClassName() +						"]. Reason: Environment must implement ConfigurableEnvironment");			}		}		// Process any @ComponentScan annotations        // 这里是根据启动类@ComponentScan注解来扫描项目中的bean		Set componentScans = AnnotationConfigUtils.attributesForRepeatable(				sourceClass.getMetadata(), ComponentScans.class, ComponentScan.class);		if (!componentScans.isEmpty() &&				!this.conditionEvaluator.shouldSkip(sourceClass.getMetadata(), ConfigurationPhase.REGISTER_BEAN)) {            			for (AnnotationAttributes componentScan : componentScans) {				// The config class is annotated with @ComponentScan -> perform the scan immediately                //遍历项目中的bean，如果是注解定义的bean，则进一步解析				Set scannedBeanDefinitions =						this.componentScanParser.parse(componentScan, sourceClass.getMetadata().getClassName());				// Check the set of scanned definitions for any further config classes and parse recursively if needed				for (BeanDefinitionHolder holder : scannedBeanDefinitions) {					BeanDefinition bdCand = holder.getBeanDefinition().getOriginatingBeanDefinition();					if (bdCand == null) {						bdCand = holder.getBeanDefinition();					}					if (ConfigurationClassUtils.checkConfigurationClassCandidate(bdCand, this.metadataReaderFactory)) {                        //递归解析，所有的bean,如果有注解，会进一步解析注解中包含的bean						parse(bdCand.getBeanClassName(), holder.getBeanName());					}				}			}		}		// Process any @Import annotations        //递归解析，获取导入的配置类，很多情况下，导入的配置类中会同样包含导入类注解		processImports(configClass, sourceClass, getImports(sourceClass), true);		// Process any @ImportResource annotations        //解析@ImportResource配置类		AnnotationAttributes importResource =				AnnotationConfigUtils.attributesFor(sourceClass.getMetadata(), ImportResource.class);		if (importResource != null) {			String[] resources = importResource.getStringArray("locations");			Class readerClass = importResource.getClass("reader");			for (String resource : resources) {				String resolvedResource = this.environment.resolveRequiredPlaceholders(resource);				configClass.addImportedResource(resolvedResource, readerClass);			}		}		// Process individual @Bean methods        //处理@Bean注解修饰的类		Set beanMethods = retrieveBeanMethodMetadata(sourceClass);		for (MethodMetadata methodMetadata : beanMethods) {			configClass.addBeanMethod(new BeanMethod(methodMetadata, configClass));		}		// Process default methods on interfaces        // 处理接口中的默认方法		processInterfaces(configClass, sourceClass);		// Process superclass, if any        //如果该类有父类，则继续返回，上层方法判断不为空，则继续递归执行		if (sourceClass.getMetadata().hasSuperClass()) {			String superclass = sourceClass.getMetadata().getSuperClassName();			if (superclass != null && !superclass.startsWith("java") &&					!this.knownSuperclasses.containsKey(superclass)) {				this.knownSuperclasses.put(superclass, configClass);				// Superclass found, return its annotation metadata and recurse				return sourceClass.getSuperClass();			}		}		// No superclass -> processing is complete		return null;	}
```

11、查看获取配置类的逻辑

```java
processImports(configClass, sourceClass, getImports(sourceClass), true);	/**	 * Returns {@code @Import} class, considering all meta-annotations.	 */	private Set getImports(SourceClass sourceClass) throws IOException {		Set imports = new LinkedHashSet<>();		Set visited = new LinkedHashSet<>();		collectImports(sourceClass, imports, visited);		return imports;	}------------------    	/**	 * Recursively collect all declared {@code @Import} values. Unlike most	 * meta-annotations it is valid to have several {@code @Import}s declared with	 * different values; the usual process of returning values from the first	 * meta-annotation on a class is not sufficient.	 *
```

##### 12、继续回到ConfigurationClassParser中的parse方法中的最后一行,继续跟进该方法：

```java
this.deferredImportSelectorHandler.process()-------------public void process() {			List deferredImports = this.deferredImportSelectors;			this.deferredImportSelectors = null;			try {				if (deferredImports != null) {					DeferredImportSelectorGroupingHandler handler = new DeferredImportSelectorGroupingHandler();					deferredImports.sort(DEFERRED_IMPORT_COMPARATOR);					deferredImports.forEach(handler::register);					handler.processGroupImports();				}			}			finally {				this.deferredImportSelectors = new ArrayList<>();			}		}---------------  public void processGroupImports() {			for (DeferredImportSelectorGrouping grouping : this.groupings.values()) {				grouping.getImports().forEach(entry -> {					ConfigurationClass configurationClass = this.configurationClasses.get(							entry.getMetadata());					try {						processImports(configurationClass, asSourceClass(configurationClass),								asSourceClasses(entry.getImportClassName()), false);					}					catch (BeanDefinitionStoreException ex) {						throw ex;					}					catch (Throwable ex) {						throw new BeanDefinitionStoreException(								"Failed to process import candidates for configuration class [" +										configurationClass.getMetadata().getClassName() + "]", ex);					}				});			}		}------------    /**		 * Return the imports defined by the group.		 * @return each import with its associated configuration class		 */		public Iterable getImports() {			for (DeferredImportSelectorHolder deferredImport : this.deferredImports) {				this.group.process(deferredImport.getConfigurationClass().getMetadata(),						deferredImport.getImportSelector());			}			return this.group.selectImports();		}	}------------    public DeferredImportSelector getImportSelector() {			return this.importSelector;		}------------    @Override		public void process(AnnotationMetadata annotationMetadata, DeferredImportSelector deferredImportSelector) {			Assert.state(deferredImportSelector instanceof AutoConfigurationImportSelector,					() -> String.format("Only %s implementations are supported, got %s",							AutoConfigurationImportSelector.class.getSimpleName(),							deferredImportSelector.getClass().getName()));			AutoConfigurationEntry autoConfigurationEntry = ((AutoConfigurationImportSelector) deferredImportSelector)					.getAutoConfigurationEntry(getAutoConfigurationMetadata(), annotationMetadata);			this.autoConfigurationEntries.add(autoConfigurationEntry);			for (String importClassName : autoConfigurationEntry.getConfigurations()) {				this.entries.putIfAbsent(importClassName, annotationMetadata);			}		}
```

# 运行原理

### 1、启动器

```xml
    org.springframework.boot    spring-boot-starter-web
```

​ springboot-boot-starter:就是springboot的场景启动器。springboot将所有的功能场景都抽取出来，做成一个个的starter，只需要在项目中引入这些starter即可，所有相关的依赖都会导入进来，根据公司业务需求决定导入什么启动器即可。

### 2、主程序

```java
package com.oi;import org.springframework.boot.SpringApplication;import org.springframework.boot.autoconfigure.SpringBootApplication;//SpringBootApplication注解用来标注一个主程序类，说明是一个springboot应用@SpringBootApplicationpublic class StudyApplication {    public static void main(String[] args) {        SpringApplication.run(StudyApplication.class, args);    }}
```

查看**@SpringBootApplication**

```java
/*@ComponentScan:自动扫描并加载符合条件的组件或者bean，将这个bean定义加载到IOC容器中@SpringBootConfiguration:标注在某个类上，表示这是一个springboot的配置类。@EnableAutoConfiguration:开启自动配置功能,之前在使用springboot的时候，springboot可以自动帮我们完成配置功能，@EnableAutoConfiguration告诉springboot开启自动配置功能，这样自动配置才能生效*/@Target(ElementType.TYPE)@Retention(RetentionPolicy.RUNTIME)@Documented@Inherited@SpringBootConfiguration@EnableAutoConfiguration@ComponentScan(excludeFilters = { @Filter(type = FilterType.CUSTOM, classes = TypeExcludeFilter.class),		@Filter(type = FilterType.CUSTOM, classes = AutoConfigurationExcludeFilter.class) })public @interface SpringBootApplication {}
```

```java
/*可以看到SpringBootConfiguration使用了Configuration注解来标注*/@Target(ElementType.TYPE)@Retention(RetentionPolicy.RUNTIME)@Documented@Configurationpublic @interface SpringBootConfiguration {}
```

```java
/*可以看到Configuration也是容器中的一个组件*/@Target(ElementType.TYPE)@Retention(RetentionPolicy.RUNTIME)@Documented@Componentpublic @interface Configuration {}
```

```java
/*@AutoConfigurationPackage:自动配置包@Import(AutoConfigurationImportSelector.class)：导入哪些组件的选择器，它将所有需要导入的组件以全类名的方式返回，这些组件就会被添加到容器中，它会给容器中导入非常多的自动配置类，就是给容器中导入这个场景需要的所有组件，并配置好这些组件*/@Target(ElementType.TYPE)@Retention(RetentionPolicy.RUNTIME)@Documented@Inherited@AutoConfigurationPackage@Import(AutoConfigurationImportSelector.class)public @interface EnableAutoConfiguration {}
```

```java
/*给容器导入一个组件，导入的组件由AutoConfigurationPackages.Registrar.class将主配置类（@SpringBootApplication标注的类）的所在包及包下面所有子包里面的所有组件扫描到spring容器*/@Target(ElementType.TYPE)@Retention(RetentionPolicy.RUNTIME)@Documented@Inherited@Import(AutoConfigurationPackages.Registrar.class)public @interface AutoConfigurationPackage {}
```

```java
/*在AutoConfigurationImportSelector类中有如下方法，可以看到*/protected List getCandidateConfigurations(AnnotationMetadata metadata, AnnotationAttributes attributes) {		List configurations = SpringFactoriesLoader.loadFactoryNames(getSpringFactoriesLoaderFactoryClass(),				getBeanClassLoader());		Assert.notEmpty(configurations, "No auto configuration classes found in META-INF/spring.factories. If you "				+ "are using a custom packaging, make sure that file is correct.");		return configurations;	}/*此时返回的就是启动自动导入配置文件的注解类*/protected Class getSpringFactoriesLoaderFactoryClass() {		return EnableAutoConfiguration.class;	}//进入SpringFactoriesLoader类中/*看到会读取对应的配置文件，位置在META-INF/spring.factories中*/public final class SpringFactoriesLoader {	/**	 * The location to look for factories.	 *
```

springboot在启动的时候从类路径下的META-INF/spring.factories中获取EnableAutoConfiguration指定的值，将这些值作为自动配置类导入容器，自动配置类就生效，帮我们进行自动配置的工作：spring.factories文件位于springboot-autoconfigure.jar包中。

所以真正实现是从classpath中搜寻所有的**META-INF/spring.factories**配置文件，并将其中对应org.springframework.boot.autoconfigure.包下的配置项通过反射实例化为对应标注了@Configuration的JavaConfig形式的IOC容器配置类，然后将这些都汇总称为一个实例并加载到IOC容器中。

# 自动配置

springboot配置文件的装配过程

1、springboot在启动的时候会加载主配置类，开启了@EnableAutoConfiguration。

2、@EnableAutoConfiguration的作用：

- 利用AutoConfigurationImportSelector给容器导入一些组件。
- 查看selectImports方法的内容，返回一个AutoConfigurationEntry

```java
AutoConfigurationEntry autoConfigurationEntry = getAutoConfigurationEntry(autoConfigurationMetadata,      annotationMetadata);------List configurations = getCandidateConfigurations(annotationMetadata, attributes);------protected List getCandidateConfigurations(AnnotationMetadata metadata, AnnotationAttributes attributes) {		List configurations = SpringFactoriesLoader.loadFactoryNames(getSpringFactoriesLoaderFactoryClass(),				getBeanClassLoader());		Assert.notEmpty(configurations, "No auto configuration classes found in META-INF/spring.factories. If you "				+ "are using a custom packaging, make sure that file is correct.");		return configurations;	}
```

- 可以看到SpringFactoriesLoader.loadFactoryNames，继续看又调用了loadSpringFactories方法，获取META-INF/spring.factories资源文件

```java
public static List loadFactoryNames(Class factoryType, @Nullable ClassLoader classLoader) {		String factoryTypeName = factoryType.getName();		return loadSpringFactories(classLoader).getOrDefault(factoryTypeName, Collections.emptyList());	}	private static Map> loadSpringFactories(@Nullable ClassLoader classLoader) {		MultiValueMap result = cache.get(classLoader);		if (result != null) {			return result;		}		try {			Enumeration urls = (classLoader != null ?					classLoader.getResources(FACTORIES_RESOURCE_LOCATION) :					ClassLoader.getSystemResources(FACTORIES_RESOURCE_LOCATION));			result = new LinkedMultiValueMap<>();			while (urls.hasMoreElements()) {				URL url = urls.nextElement();				UrlResource resource = new UrlResource(url);				Properties properties = PropertiesLoaderUtils.loadProperties(resource);				for (Map.Entry entry : properties.entrySet()) {					String factoryTypeName = ((String) entry.getKey()).trim();					for (String factoryImplementationName : StringUtils.commaDelimitedListToStringArray((String) entry.getValue())) {						result.add(factoryTypeName, factoryImplementationName.trim());					}				}			}			cache.put(classLoader, result);			return result;		}		catch (IOException ex) {			throw new IllegalArgumentException("Unable to load factories from location [" +					FACTORIES_RESOURCE_LOCATION + "]", ex);		}	}
```

总结：将类路径下 META-INF/spring.factories 里面配置的所有EnableAutoConfiguration的值加入到了容器中；每一个xxxAutoConfiguration类都是容器中的一个组件，最后都加入到容器中，用来做自动配置，每一个自动配置类都可以进行自动配置功能

使用HttpEncodingAutoConfiguration来解释自动装配原理

```java
/*表名这是一个配置类，*/@Configuration(proxyBeanMethods = false)/*启动指定类的ConfigurationProperties功能,进入HttpProperties查看，将配置文件中对应的值和HttpProperties绑定起来，并把HttpProperties加入到ioc容器中*/@EnableConfigurationProperties(HttpProperties.class)/*spring底层@Confitional注解，根据不同的条件判断，如果满足指定的条件，整个配置类里面的配置就会生效此时表示判断当前应用是否是web应用，如果是，那么配置类生效*/@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)/*判断当前项目由没有这个类CharacterEncodingFilter，springmvc中进行乱码解决的过滤器*/@ConditionalOnClass(CharacterEncodingFilter.class)/*判断配置文件中是否存在某个配置：spring.http.encoding.enabled如果不存在，判断也是成立的，即使我们配置文件中不配置spring.http.encoding.enabled=true，也是默认生效的*/@ConditionalOnProperty(prefix = "spring.http.encoding", value = "enabled", matchIfMissing = true)public class HttpEncodingAutoConfiguration {    //和springboot的配置文件映射	private final HttpProperties.Encoding properties;    //只有一个有参构造器的情况下，参数的值就会从容器中拿	public HttpEncodingAutoConfiguration(HttpProperties properties) {		this.properties = properties.getEncoding();	}    //给容器中添加一个组件，这个组件的某些值需要从properties中获取	@Bean	@ConditionalOnMissingBean//判断容器中是否有此组件	public CharacterEncodingFilter characterEncodingFilter() {		CharacterEncodingFilter filter = new OrderedCharacterEncodingFilter();		filter.setEncoding(this.properties.getCharset().name());		filter.setForceRequestEncoding(this.properties.shouldForce(Type.REQUEST));		filter.setForceResponseEncoding(this.properties.shouldForce(Type.RESPONSE));		return filter;	}	@Bean	public LocaleCharsetMappingsCustomizer localeCharsetMappingsCustomizer() {		return new LocaleCharsetMappingsCustomizer(this.properties);	}	private static class LocaleCharsetMappingsCustomizer			implements WebServerFactoryCustomizer, Ordered {		private final HttpProperties.Encoding properties;		LocaleCharsetMappingsCustomizer(HttpProperties.Encoding properties) {			this.properties = properties;		}		@Override		public void customize(ConfigurableServletWebServerFactory factory) {			if (this.properties.getMapping() != null) {				factory.setLocaleCharsetMappings(this.properties.getMapping());			}		}		@Override		public int getOrder() {			return 0;		}	}}
```

根据当前不同的条件判断，决定这个配置类是否生效！

总结：

​ 1、springboot启动会加载大量的自动配置类

​ 2、查看需要的功能有没有在springboot默认写好的自动配置类中华

​ 3、查看这个自动配置类到底配置了哪些组件

​ 4、给容器中自动配置类添加组件的时候，会从properties类中获取属性

@Conditional：自动配置类在一定条件下才能生效

@Conditional扩展注解

作用

@ConditionalOnJava

系统的java版本是否符合要求

@ConditionalOnBean

容器中存在指定Bean

@ConditionalOnMissingBean

容器中不存在指定Bean

@ConditionalOnExpression

满足SpEL表达式

@ConditionalOnClass

系统中有指定的类

@ConditionalOnMissingClass

系统中没有指定的类

@ConditionalOnSingleCandidate

容器中只有一个指定的Bean，或者是首选Bean

@ConditionalOnProperty

系统中指定的属性是否有指定的值

@ConditionalOnResource

类路径下是否存在指定资源文件

@ConditionOnWebApplication

当前是web环境

@ConditionalOnNotWebApplication

当前不是web环境

@ConditionalOnJndi

JNDI存在指定项
