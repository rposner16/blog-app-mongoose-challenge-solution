'use strict';

// Setting up requirements
const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const expect = chai.expect;

const { BlogPost } = require('../models');
const { app, runServer, closeServer } = require('../server');
const TEST_DATABASE_URL = require('../config');

chai.use(chaiHttp);

// Set up an array of 10 blogposts and put them in the database 
function seedBlogPostData() {
    console.info('Seeding blogpost data');
    const seedData = [];

    for (let i = 1; i < 10; i++) {
        seedData.push(generateBlogPostData());
    }

    return BlogPost.insertMany(seedData);
}

// Generate a test blog post using faker (called by seedBlogPostData)
function generateBlogPostData() {
    return {
        author: {
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName()
        },
        title: faker.lorem.word(),
        content: faker.lorem.paragraph(),
        created: faker.date.recent()
    };
}

// Clear out the database when we're done testing
function tearDownDb() {
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}

// Overall description for blog API tests
describe('BlogPost API resource', function() {

    // Hooks to run functions associated with testing

    // Before running tests, start the server
    before(function() {
        return runServer(TEST_DATABASE_URL);
    });

    // Before each test, put test data in the database
    beforeEach(function() {
        return seedBlogPostData();
    });

    // After each test, remove the test data from the database
    afterEach(function() {
        return tearDownDb();
    });

    // After running tests, close the server
    after(function() {
        return closeServer();
    });

    // Tests for get endpoint
    describe('GET endpoint', function() {

        /*
        Sends a get request, then checks to make sure response with 
        appropriate length and status is sent back
        */
        it('should return all existing blog posts', function() {

            let res;

            return chai.request(app)
            .get('/posts')
            .then(function(_res) {

                res = _res;
                expect(res).to.have.status(200);
                expect(res.body).to.have.lengthOf.at.least(1);

                return BlogPost.count();
            })
            .then(function(count) {
                expect(res.body).to.have.lengthOf(count);
            });
        });

        /* 
        Sends a get request, makes sure that each post returned
        has the right fields.  Takes the first post returned and 
        searches for it by id in the database, makes sure that its
        fields match what's found in the database
        */
        it('should return blog posts with correct fields', function() {

            let resBlogPost;

            return chai.request(app)
            .get('/posts')
            .then(function(res) {

                expect(res).to.have.status(200);
                expect(res).to.be.json;
                expect(res.body).to.be.a('array');
                expect(res.body).to.have.lengthOf.at.least(1);

                res.body.forEach(function(blogPost) {
                    expect(blogPost).to.be.a('object');
                    expect(blogPost).to.include.keys('id', 'author', 'title', 'content', 'created');
                });

                resBlogPost = res.body[0];
                return BlogPost.findById(resBlogPost.id);
            })
            .then(function(blogPost) {

                // Checking that first post in the response matches 
                // contents of database
                expect(resBlogPost.id).to.equal(blogPost.id);
                expect(resBlogPost.author).to.equal(`${blogPost.author.firstName} ${blogPost.author.lastName}`);
                expect(resBlogPost.title).to.equal(blogPost.title);
                expect(resBlogPost.content).to.equal(blogPost.content);
                expect(resBlogPost.created).to.equal(blogPost.created);
            });
        });
    });

    // Test for post endpoint
    describe('POST endpoint', function() {

        /*
        Create a new blog post by calling generateBlogPostData, then
        make sure that the response object matches the new post.
        Then, search for the new post in the database by id, and
        confirm that the search result matches the new post.
        */
        it('should add a new post with the correct fields', function() {

            const newBlogPost = generateBlogPostData();

            return chai.request(app)
            .post('/posts')
            .send(newBlogPost)
            .then(function(res) {

                expect(res).to.have.status(201);
                expect(res).to.be.json;
                expect(res.body).to.be.a('object');
                expect(res.body).to.include.keys('id', 'author', 'title', 'content', 'created');
                expect(res.body.id).to.not.be.null;
                expect(res.body.author).to.equal(`${newBlogPost.author.firstName} ${newBlogPost.author.lastName}`);
                expect(res.body.title).to.equal(newBlogPost.title);
                expect(res.body.content).to.equal(newBlogPost.content);
                expect(res.body.created).to.equal(newBlogPost.created);
                
                return BlogPost.findById(res.body.id);
            })
            .then(function(blogPost) {

                expect(blogPost.title).to.equal(newBlogPost.title);
                expect(blogPost.author.firstName).to.equal(newBlogPost.author.firstName);
                expect(blogPost.author.lastName).to.equal(newBlogPost.author.lastName);
                expect(blogPost.content).to.equal(newBlogPost.content);
                expect(blogPost.created).to.equal(newBlogPost.created);
            });
        });
    });

    // Test for put endpoint
    describe('PUT endpoint', function() {

        /*
        Create an object with fields to be updated (updatedFields), then retrieve
        an existing post from the database, assign its id to updatedFields,
        and send updatedFields in a put request.  Make sure the response has
        the appropriate status, then find the updated post by id in the 
        database and make sure that its fields match those of the updatedFields
        object.
        */
        it('should update fields that are sent over', function() {
            const updatedFields = {
                title: "A New Title",
                content: "jiow;fijewfkljdslfjejl",
                author: {
                    firstName: "Bob",
                    lastName: "Smith"
                }
            };
            return BlogPost.findOne()
            .then(function(blogPost) {
                updatedFields.id = blogPost.id;
                return chai.request(app)
                .put(`/posts/${blogPost.id}`)
                .send(updatedFields)
            })
            .then(function(res) {
                expect(res).to.have.status(204);
                return BlogPost.findById(updatedFields.id);
            })
            .then(function(blogPost) {
                expect(blogPost.title).to.equal(updatedFields.title);
                expect(blogPost.content).to.equal(updatedFields.content);
                expect(blogPost.author.firstName).to.equal(updatedFields.author.firstName);
                expect(blogPost.author.lastName).to.equal(updatedFields.author.lastName);
            });
        });
    });

    /*
    Find a post in the database, then send a delete request with its id.
    Make sure that the response has the appropriate status, then find
    the post by its id in the database again and make sure that it 
    doesn't exist.
    */
    describe('DELETE endpoint', function() {

        it('should delete a restaurant given its id', function() {
            let blogPost;
            return BlogPost.findOne()
            .then(function(_blogPost) {
                blogPost = _blogPost;
                return chai.request(app).delete(`/posts/${blogPost.id}`);
            })
            .then(function(res) {
                expect(res).to.have.status(204);
                return BlogPost.findById(blogPost.id);
            })
            .then(function(_blogPost) {
                expect(_blogPost).to.be.null;
            });
        });
    });
});