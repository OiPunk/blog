---
title: 'Spring IOC的注解使用'
date: '2020-04-03'
tags: ['框架', 'Spring', 'IOC']
draft: false
summary: '除了使用xml文件进行bean或者某些属性的赋值，还有另外一种注解的方式，在企业开发中使用的很多，在bean上添加注解，可以快速的将bean注册到ioc容器。'
---

# Spring IOC的注解使用

​ 在之前的项目中，我们都是通过xml文件进行bean或者某些属性的赋值，其实还有另外一种注解的方式，在企业开发中使用的很多，在bean上添加注解，可以快速的将bean注册到ioc容器。

### 1、使用注解的方式注册bean到IOC容器中

applicationContext.xml

PersonController.java

```java
package com.oi.controller;import org.springframework.stereotype.Controller;@Controllerpublic class PersonController {    public PersonController() {        System.out.println("创建对象");    }}
```

PersonService.java

```java
package com.oi.service;import org.springframework.stereotype.Service;@Servicepublic class PersonService {}
```

PersonDao.java

```java
package com.oi.dao;import org.springframework.stereotype.Repository;@Repository("personDao")@Scope(value="prototype")public class PersonDao {}
```

### 2、定义扫描包时要包含的类和不要包含的类

​ 当定义好基础的扫描包后，在某些情况下可能要有选择性的配置是否要注册bean到IOC容器中，此时可以通过如下的方式进行配置。

applicationContext.xml

### 3、使用@AutoWired进行自动注入

​ 使用注解的方式实现自动注入需要使用@AutoWired注解。

PersonController.java

```java
package com.oi.controller;import com.oi.service.PersonService;import org.springframework.beans.factory.annotation.Autowired;import org.springframework.stereotype.Controller;@Controllerpublic class PersonController {    @Autowired    private PersonService personService;    public PersonController() {        System.out.println("创建对象");    }    public void getPerson(){        personService.getPerson();    }}
```

PersonService.java

```java
package com.oi.service;import com.oi.dao.PersonDao;import org.springframework.beans.factory.annotation.Autowired;import org.springframework.stereotype.Service;@Servicepublic class PersonService {    @Autowired    private PersonDao personDao;    public void getPerson(){        personDao.getPerson();    }}
```

PersonDao.java

```java
package com.oi.dao;        import org.springframework.stereotype.Repository;@Repositorypublic class PersonDao {    public void getPerson(){        System.out.println("PersonDao:getPerson");    }}
```

注意：当使用AutoWired注解的时候，自动装配的时候是根据类型实现的。

​ 1、如果只找到一个，则直接进行赋值，

​ 2、如果没有找到，则直接抛出异常，

​ 3、如果找到多个，那么会按照变量名作为id继续匹配,

​ 1、匹配上直接进行装配

​ 2、如果匹配不上则直接报异常

PersonServiceExt.java

```java
package com.oi.service;import com.oi.dao.PersonDao;import org.springframework.beans.factory.annotation.Autowired;import org.springframework.stereotype.Service;@Servicepublic class PersonServiceExt extends PersonService{    @Autowired    private PersonDao personDao;    public void getPerson(){        System.out.println("PersonServiceExt......");        personDao.getPerson();    }}
```

PersonController.java

```java
package com.oi.controller;import com.oi.service.PersonService;import org.springframework.beans.factory.annotation.Autowired;import org.springframework.stereotype.Controller;@Controllerpublic class PersonController {    @Autowired    private PersonService personServiceExt;    public PersonController() {        System.out.println("创建对象");    }    public void getPerson(){        personServiceExt.getPerson();    }}
```

​ 还可以使用@Qualifier注解来指定id的名称，让spring不要使用变量名,当使用@Qualifier注解的时候也会有两种情况：

​ 1、找到，则直接装配

​ 2、找不到，就会报错

PersonController.java

```java
package com.oi.controller;import com.oi.service.PersonService;import org.springframework.beans.factory.annotation.Autowired;import org.springframework.beans.factory.annotation.Qualifier;import org.springframework.stereotype.Controller;@Controllerpublic class PersonController {    @Autowired    @Qualifier("personService")    private PersonService personServiceExt2;    public PersonController() {        System.out.println("创建对象");    }    public void getPerson(){        personServiceExt2.getPerson();    }}
```

​ 通过上述的代码我们能够发现，使用@AutoWired肯定是能够装配上的，如果装配不上就会报错。

### 4、@AutoWired可以进行定义在方法上

​ 当我们查看@AutoWired注解的源码的时候发现，此注解不仅可以使用在成员变量上，也可以使用在方法上。

PersonController.java

```java
package com.oi.controller;import com.oi.dao.PersonDao;import com.oi.service.PersonService;import org.springframework.beans.factory.annotation.Autowired;import org.springframework.beans.factory.annotation.Qualifier;import org.springframework.stereotype.Controller;@Controllerpublic class PersonController {    @Qualifier("personService")    @Autowired    private PersonService personServiceExt2;    public PersonController() {        System.out.println("创建对象");    }    public void getPerson(){        System.out.println("personController..."+personServiceExt2);//        personServiceExt2.getPerson();    }     /**     * 当方法上有@AutoWired注解时：     *  1、此方法在bean创建的时候会自动调用     *  2、这个方法的每一个参数都会自动注入值     * @param personDao     */    @Autowired    public void test(PersonDao personDao){        System.out.println("此方法被调用:"+personDao);    }        /**     * @Qualifier注解也可以作用在属性上，用来被当作id去匹配容器中的对象，如果没有     * 此注解，那么直接按照类型进行匹配     * @param personService     */    @Autowired    public void test2(@Qualifier("personServiceExt") PersonService personService){        System.out.println("此方法被调用："+personService);    }}
```

### 5、自动装配的注解@AutoWired，@Resource

​ 在使用自动装配的时候，出了可以使用@AutoWired注解之外，还可以使用@Resource注解，大家需要知道这两个注解的区别。

​ 1、@AutoWired:是spring中提供的注解，@Resource:是jdk中定义的注解，依靠的是java的标准

​ 2、@AutoWired默认是按照类型进行装配，默认情况下要求依赖的对象必须存在，@Resource默认是按照名字进行匹配的，同时可以指定name属性。

​ 3、@AutoWired只适合spring框架，而@Resource扩展性更好

PersonController.java

```java
package com.oi.controller;import com.oi.dao.PersonDao;import com.oi.service.PersonService;import org.springframework.beans.factory.annotation.Autowired;import org.springframework.beans.factory.annotation.Qualifier;import org.springframework.stereotype.Controller;import javax.annotation.Resource;@Controllerpublic class PersonController {    @Qualifier("personService")    @Resource    private PersonService personServiceExt2;    public PersonController() {        System.out.println("创建对象");    }    public void getPerson(){        System.out.println("personController..."+personServiceExt2);        personServiceExt2.getPerson();    }    /**     * 当方法上有@AutoWired注解时：     *  1、此方法在bean创建的时候会自动调用     *  2、这个方法的每一个参数都会自动注入值     * @param personDao     */    @Autowired    public void test(PersonDao personDao){        System.out.println("此方法被调用:"+personDao);    }    /**     * @Qualifier注解也可以作用在属性上，用来被当作id去匹配容器中的对象，如果没有     * 此注解，那么直接按照类型进行匹配     * @param personService     */    @Autowired    public void test2(@Qualifier("personServiceExt") PersonService personService){        System.out.println("此方法被调用："+personService);    }}
```

### 6、泛型依赖注入

​ 为了讲解泛型依赖注入，首先我们需要先写一个基本的案例，按照我们之前学习的知识：

Student.java

```java
package com.oi.bean;public class Student {}
```

Teacher.java

```java
package com.oi.bean;public class Teacher {}
```

BaseDao.java

```java
package com.oi.dao;import org.springframework.stereotype.Repository;@Repositorypublic abstract class BaseDao {    public abstract void save();}
```

StudentDao.java

```java
package com.oi.dao;import com.oi.bean.Student;import org.springframework.stereotype.Repository;@Repositorypublic class StudentDao extends BaseDao{    public void save() {        System.out.println("保存学生");    }}
```

TeacherDao.java

```java
package com.oi.dao;import com.oi.bean.Teacher;import org.springframework.stereotype.Repository;@Repositorypublic class TeacherDao extends BaseDao {    public void save() {        System.out.println("保存老师");    }}
```

StudentService.java

```java
package com.oi.service;import com.oi.dao.StudentDao;import org.springframework.beans.factory.annotation.Autowired;import org.springframework.stereotype.Service;@Servicepublic class StudentService {    @Autowired    private StudentDao studentDao;    public void save(){        studentDao.save();    }}
```

TeacherService.java

```java
package com.oi.service;import com.oi.dao.TeacherDao;import org.springframework.beans.factory.annotation.Autowired;import org.springframework.stereotype.Service;@Servicepublic class TeacherService {    @Autowired    private TeacherDao teacherDao;    public void save(){        teacherDao.save();    }}
```

MyTest.java

```java
import com.oi.service.StudentService;import com.oi.service.TeacherService;import org.springframework.context.ApplicationContext;import org.springframework.context.support.ClassPathXmlApplicationContext;import javax.sql.DataSource;import java.sql.SQLException;public class MyTest {    public static void main(String[] args) throws SQLException {        ApplicationContext context = new ClassPathXmlApplicationContext("applicationContext.xml");        StudentService studentService = context.getBean("studentService",StudentService.class);        studentService.save();        TeacherService teacherService = context.getBean("teacherService",TeacherService.class);        teacherService.save();    }}
```

​ 上述代码是我们之前的可以完成的功能，但是可以思考，Service层的代码是否能够改写：

BaseService.java

```java
package com.oi.service;import com.oi.dao.BaseDao;import org.springframework.beans.factory.annotation.Autowired;import org.springframework.stereotype.Service;public class BaseService {        @Autowired    BaseDao baseDao;        public void save(){        System.out.println("自动注入的对象："+baseDao);        baseDao.save();    }}
```

StudentService.java

```java
package com.oi.service;import com.oi.bean.Student;import com.oi.dao.StudentDao;import org.springframework.beans.factory.annotation.Autowired;import org.springframework.stereotype.Service;@Servicepublic class StudentService extends BaseService {}
```

TeacherService.java

```java
package com.oi.service;import com.oi.bean.Teacher;import com.oi.dao.TeacherDao;import org.springframework.beans.factory.annotation.Autowired;import org.springframework.stereotype.Service;@Servicepublic class TeacherService extends BaseService{}
```
